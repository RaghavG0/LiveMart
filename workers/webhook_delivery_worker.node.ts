// Webhook Delivery Worker
// Processes webhook queue and delivers events to partner endpoints

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const BATCH_SIZE = parseInt(process.env.WEBHOOK_BATCH_SIZE || '10');
const POLL_INTERVAL_MS = parseInt(process.env.WEBHOOK_POLL_INTERVAL_MS || '5000');
const RUN_ONCE = process.env.WEBHOOK_RUN_ONCE === 'true';

interface WebhookSubscription {
  id: string;
  url: string;
  secret_key: string;
  custom_headers: Record<string, string>;
  timeout_seconds: number;
}

interface QueueItem {
  id: string;
  subscription_id: string;
  event_type: string;
  event_data: any;
  attempts: number;
  max_attempts: number;
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Deliver webhook to endpoint
 */
async function deliverWebhook(
  subscription: WebhookSubscription,
  queueItem: QueueItem
): Promise<{
  success: boolean;
  status?: number;
  responseBody?: string;
  responseTimeMs?: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    const payload = JSON.stringify({
      event: queueItem.event_type,
      timestamp: new Date().toISOString(),
      data: queueItem.event_data,
      attempt: queueItem.attempts
    });

    const signature = generateSignature(payload, subscription.secret_key);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-LiveMart-Event': queueItem.event_type,
      'X-LiveMart-Signature': signature,
      'X-LiveMart-Delivery-ID': queueItem.id,
      'User-Agent': 'LiveMart-Webhooks/1.0',
      ...subscription.custom_headers
    };

    console.log(`Delivering webhook to ${subscription.url} (attempt ${queueItem.attempts})`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), subscription.timeout_seconds * 1000);

    const response = await fetch(subscription.url, {
      method: 'POST',
      headers,
      body: payload,
      signal: controller.signal
    });

    clearTimeout(timeout);

    const responseTimeMs = Date.now() - startTime;
    const responseBody = await response.text().catch(() => '');

    console.log(`Webhook delivered: ${response.status} (${responseTimeMs}ms)`);

    return {
      success: response.ok,
      status: response.status,
      responseBody: responseBody.substring(0, 1000), // Limit size
      responseTimeMs
    };

  } catch (error: any) {
    const responseTimeMs = Date.now() - startTime;
    console.error(`Webhook delivery failed:`, error.message);

    return {
      success: false,
      responseTimeMs,
      error: error.message
    };
  }
}

/**
 * Process pending webhooks from queue
 */
async function processWebhookQueue(): Promise<number> {
  try {
    // Get pending queue items
    const { data: queueItems, error: queueError } = await supabase
      .from('webhook_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('next_attempt_at', new Date().toISOString())
      .lt('attempts', supabase.rpc('max_attempts'))
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (queueError) throw queueError;
    if (!queueItems || queueItems.length === 0) {
      return 0;
    }

    console.log(`Processing ${queueItems.length} webhook deliveries...`);

    let successCount = 0;

    for (const queueItem of queueItems) {
      // Get subscription details
      const { data: subscription, error: subError } = await supabase
        .from('webhook_subscriptions')
        .select('*')
        .eq('id', queueItem.subscription_id)
        .eq('status', 'active')
        .single();

      if (subError || !subscription) {
        console.warn(`Subscription ${queueItem.subscription_id} not found or inactive`);
        
        // Remove from queue
        await supabase
          .from('webhook_queue')
          .delete()
          .eq('id', queueItem.id);
        
        continue;
      }

      // Mark as processing
      await supabase
        .from('webhook_queue')
        .update({ status: 'processing' })
        .eq('id', queueItem.id);

      // Deliver webhook
      const result = await deliverWebhook(subscription, queueItem);

      // Record delivery
      await supabase.rpc('record_webhook_delivery', {
        p_subscription_id: subscription.id,
        p_queue_id: queueItem.id,
        p_event_type: queueItem.event_type,
        p_event_id: queueItem.event_data.id || null,
        p_payload: queueItem.event_data,
        p_attempt_number: queueItem.attempts + 1,
        p_success: result.success,
        p_response_status: result.status || null,
        p_response_body: result.responseBody || null,
        p_response_time_ms: result.responseTimeMs || null,
        p_error_message: result.error || null
      });

      if (result.success) {
        successCount++;
        console.log(`✓ Webhook delivered successfully: ${subscription.url}`);
      } else {
        console.log(`✗ Webhook delivery failed: ${subscription.url} (will retry)`);
      }

      // Rate limiting: small delay between deliveries
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return successCount;

  } catch (error) {
    console.error('Error processing webhook queue:', error);
    return 0;
  }
}

/**
 * Clean up old delivery logs
 */
async function cleanupOldLogs(): Promise<void> {
  try {
    const retentionDays = 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const { error } = await supabase
      .from('webhook_deliveries')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) throw error;

    console.log(`Cleaned up webhook delivery logs older than ${retentionDays} days`);
  } catch (error) {
    console.error('Error cleaning up logs:', error);
  }
}

/**
 * Monitor webhook health and auto-pause failing subscriptions
 */
async function monitorWebhookHealth(): Promise<void> {
  try {
    const { data: failingSubscriptions, error } = await supabase
      .from('webhook_subscriptions')
      .select('id, name, url, consecutive_failures')
      .eq('status', 'active')
      .gte('consecutive_failures', 10);

    if (error) throw error;
    if (!failingSubscriptions || failingSubscriptions.length === 0) {
      return;
    }

    console.warn(`Found ${failingSubscriptions.length} subscriptions with repeated failures`);

    for (const sub of failingSubscriptions) {
      await supabase
        .from('webhook_subscriptions')
        .update({ 
          status: 'failed',
          last_error: `Auto-paused after ${sub.consecutive_failures} consecutive failures`
        })
        .eq('id', sub.id);

      console.warn(`Auto-paused webhook: ${sub.name} (${sub.url})`);
    }
  } catch (error) {
    console.error('Error monitoring webhook health:', error);
  }
}

/**
 * Main worker function
 */
async function runWebhookWorker(): Promise<void> {
  console.log('=== Starting Webhook Delivery Worker ===');
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`Run once: ${RUN_ONCE}`);

  const startTime = Date.now();
  
  const deliveredCount = await processWebhookQueue();
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`=== Webhook Worker Completed in ${duration}s ===`);
  console.log(`Delivered: ${deliveredCount} webhooks`);

  // Periodic maintenance (every 100 runs or once per day)
  if (Math.random() < 0.01) {
    await cleanupOldLogs();
    await monitorWebhookHealth();
  }
}

/**
 * Entry point
 */
async function main() {
  if (RUN_ONCE) {
    await runWebhookWorker();
    process.exit(0);
  } else {
    // Run immediately
    await runWebhookWorker();

    // Then run on interval
    setInterval(async () => {
      await runWebhookWorker();
    }, POLL_INTERVAL_MS);

    console.log(`Webhook worker running continuously (every ${POLL_INTERVAL_MS}ms)`);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
