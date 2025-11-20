// Notification worker: polls due notifications, sends via providers, records attempts, finalizes.
// This script is intended to run in a separate process or cron schedule.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface QueueItem {
  id: string;
  event_type: string;
  user_id: string | null;
  channels: string[];
  event_payload: any;
  dedup_key: string | null;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // Needed for service role policies
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Provider stubs (replace with real integrations):
async function sendEmail(userId: string, subject: string, html: string, text: string) {
  // Integrate with actual email provider (e.g., Resend, SendGrid)
  return { success: true, id: crypto.randomUUID() };
}
async function sendSMS(userId: string, body: string) {
  return { success: true };
}
async function sendPush(userId: string, title: string, body: string) {
  return { success: true };
}

async function fetchTemplate(eventType: string, channel: string, language: string) {
  const { data, error } = await supabase
    .from("notification_templates")
    .select("subject, body_html, body_text, push_title, push_body")
    .eq("event_type", eventType)
    .eq("channel", channel)
    .eq("language_code", language)
    .single();
  if (error) return null;
  return data;
}

function renderTemplate(template: any, payload: Record<string, any>) {
  const replaceVars = (str?: string) => str?.replace(/{{(\w+)}}/g, (_, k) => payload[k] ?? '');
  return {
    subject: replaceVars(template?.subject),
    body_html: replaceVars(template?.body_html),
    body_text: replaceVars(template?.body_text),
    push_title: replaceVars(template?.push_title),
    push_body: replaceVars(template?.push_body),
  };
}

async function processBatch() {
  // Get due notifications
  const { data: due, error } = await supabase.rpc('process_due_notifications', { p_batch_size: 25 });
  if (error) {
    console.error('process_due_notifications error', error);
    return;
  }
  if (!due || due.length === 0) {
    console.log('No due notifications');
    return;
  }
  for (const item of due as QueueItem[]) {
    try {
      // Fetch user prefs for language
      let language = 'en';
      if (item.user_id) {
        const { data: prefs } = await supabase
          .from('user_notification_preferences')
          .select('preferred_language')
          .eq('user_id', item.user_id)
          .single();
        if (prefs?.preferred_language) language = prefs.preferred_language;
      }
      const payload = item.event_payload || {};
      let anySuccess = false;
      for (const channel of item.channels) {
        const template = await fetchTemplate(item.event_type, channel, language);
        const rendered = renderTemplate(template || {}, payload);
        let attemptSuccess = false;
        let providerResp: any = null;
        let errorMessage: string | null = null;
        try {
          if (channel === 'email' && item.user_id) {
            const r = await sendEmail(item.user_id, rendered.subject || 'Notification', rendered.body_html || '', rendered.body_text || '');
            attemptSuccess = r.success;
            providerResp = r;
          } else if (channel === 'sms' && item.user_id) {
            const r = await sendSMS(item.user_id, rendered.body_text || rendered.subject || '');
            attemptSuccess = r.success;
            providerResp = r;
          } else if (channel === 'push' && item.user_id) {
            const r = await sendPush(item.user_id, rendered.push_title || rendered.subject || 'Notification', rendered.push_body || rendered.body_text || '');
            attemptSuccess = r.success;
            providerResp = r;
          } else {
            errorMessage = 'Unsupported channel or missing user_id';
          }
        } catch (chErr) {
          errorMessage = (chErr as Error).message;
        }
        if (attemptSuccess) anySuccess = true;
        // Record attempt
        const { error: attemptError } = await supabase.rpc('mark_notification_attempt', {
          p_queue_id: item.id,
          p_channel: channel,
          p_success: attemptSuccess,
          p_provider_response: providerResp,
          p_error_message: errorMessage,
        });
        if (attemptError) console.error('mark_notification_attempt error', attemptError);
      }
      // Finalize if at least one success OR after all attempts this round
      if (anySuccess) {
        const { error: finalizeError } = await supabase.rpc('finalize_notification', {
          p_queue_id: item.id,
          p_delivery_status: anySuccess ? 'success' : 'failed',
          p_log_payload: payload,
          p_dedup_key: item.dedup_key,
        });
        if (finalizeError) console.error('finalize_notification error', finalizeError);
      }
    } catch (err) {
      console.error('Worker item error', item.id, err);
    }
  }
}

if (import.meta.main) {
  const intervalMs = parseInt(Deno.env.get('NOTIFICATION_WORKER_INTERVAL_MS') || '60000');
  console.log('Notification worker started. Interval(ms)=', intervalMs);
  await processBatch();
  // If long-lived process, loop
  if (Deno.env.get('NOTIFICATION_WORKER_CONTINUOUS') === 'true') {
    setInterval(() => { processBatch(); }, intervalMs);
  }
}
