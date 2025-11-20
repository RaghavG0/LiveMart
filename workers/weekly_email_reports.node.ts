// Weekly Email Report Worker - Node.js Version
// Sends scheduled summary emails to retailers/wholesalers with performance highlights

import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Email service configuration (stub - replace with actual service)
const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'http://localhost:3000/send-email';
const EMAIL_FROM = process.env.EMAIL_FROM || 'reports@livemart.com';

// Send email via external service
async function sendEmail(to: string, subject: string, html: string, text: string, attachments: any[] = []) {
  // Stub implementation - replace with actual email service (SendGrid, AWS SES, etc.)
  console.log(`Sending email to ${to}: ${subject}`);
  
  try {
    const response = await fetch(EMAIL_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to,
        subject,
        html,
        text,
        attachments
      })
    });
    
    if (!response.ok) {
      throw new Error(`Email service returned ${response.status}`);
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

// Generate HTML email template for weekly summary
function generateWeeklySummaryHTML(retailerName: string, summary: any, topSKUs: any[], complaints: any): string {
  const {
    total_orders = 0,
    total_revenue = 0,
    total_reviews = 0,
    avg_rating = 0,
    avg_nps_score = 0
  } = summary.overview || {};
  
  const { revenue_trend = 'stable', rating_trend = 'stable' } = summary.trends || {};
  
  const trendIcon = (trend: string) => {
    if (trend === 'up') return '📈';
    if (trend === 'down') return '📉';
    return '➡️';
  };
  
  const ratingColor = (rating: number) => {
    if (rating >= 4.5) return '#10b981';
    if (rating >= 4.0) return '#f59e0b';
    return '#ef4444';
  };
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .header p {
      margin: 10px 0 0;
      opacity: 0.9;
    }
    .content {
      padding: 30px;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin: 20px 0;
    }
    .metric-card {
      background: #f8fafc;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .metric-value {
      font-size: 32px;
      font-weight: bold;
      color: #667eea;
      margin: 10px 0;
    }
    .metric-label {
      font-size: 14px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-trend {
      font-size: 18px;
      margin-left: 8px;
    }
    .section {
      margin: 30px 0;
    }
    .section-title {
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 15px;
      color: #1e293b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th {
      background: #f1f5f9;
      padding: 12px;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .complaint-bar {
      height: 20px;
      background: #ef4444;
      border-radius: 4px;
      position: relative;
    }
    .complaint-count {
      position: absolute;
      right: 8px;
      color: white;
      font-size: 12px;
      font-weight: bold;
      line-height: 20px;
    }
    .footer {
      background: #f8fafc;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
    .cta-button {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Weekly Performance Report</h1>
      <p>Hello ${retailerName}! Here's your weekly summary.</p>
      <p style="font-size: 14px; margin-top: 15px;">${summary.period?.start_date} to ${summary.period?.end_date}</p>
    </div>
    
    <div class="content">
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">Total Orders</div>
          <div class="metric-value">${total_orders}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Revenue <span class="metric-trend">${trendIcon(revenue_trend)}</span></div>
          <div class="metric-value">$${parseFloat(total_revenue).toFixed(2)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Avg Rating <span class="metric-trend">${trendIcon(rating_trend)}</span></div>
          <div class="metric-value" style="color: ${ratingColor(avg_rating)}">
            ${avg_rating ? avg_rating.toFixed(1) : 'N/A'}
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-label">NPS Score</div>
          <div class="metric-value" style="color: ${avg_nps_score >= 50 ? '#10b981' : avg_nps_score >= 0 ? '#f59e0b' : '#ef4444'}">
            ${avg_nps_score ? avg_nps_score.toFixed(0) : '0'}
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">🏆 Top Performing Products</div>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Units Sold</th>
              <th>Revenue</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            ${topSKUs.map(sku => `
              <tr>
                <td>${sku.product_name}</td>
                <td>${sku.total_units_sold}</td>
                <td>$${parseFloat(sku.total_revenue).toFixed(2)}</td>
                <td style="color: ${ratingColor(sku.avg_rating)}">
                  ${sku.avg_rating ? sku.avg_rating.toFixed(1) : 'N/A'} ⭐
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      ${complaints && Object.values(complaints).some((v: any) => v > 0) ? `
      <div class="section">
        <div class="section-title">⚠️ Customer Complaints</div>
        <p style="color: #64748b; margin-bottom: 15px;">Areas needing attention:</p>
        ${complaints.quality_issues > 0 ? `
        <div style="margin: 10px 0;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span>Quality Issues</span>
            <span style="font-weight: bold;">${complaints.quality_issues}</span>
          </div>
          <div class="complaint-bar" style="width: ${Math.min(complaints.quality_issues * 10, 100)}%"></div>
        </div>
        ` : ''}
        ${complaints.delivery_issues > 0 ? `
        <div style="margin: 10px 0;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span>Delivery Issues</span>
            <span style="font-weight: bold;">${complaints.delivery_issues}</span>
          </div>
          <div class="complaint-bar" style="width: ${Math.min(complaints.delivery_issues * 10, 100)}%"></div>
        </div>
        ` : ''}
        ${complaints.packaging_issues > 0 ? `
        <div style="margin: 10px 0;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span>Packaging Issues</span>
            <span style="font-weight: bold;">${complaints.packaging_issues}</span>
          </div>
          <div class="complaint-bar" style="width: ${Math.min(complaints.packaging_issues * 10, 100)}%"></div>
        </div>
        ` : ''}
      </div>
      ` : ''}
      
      <div style="text-align: center; margin-top: 30px;">
        <a href="${SUPABASE_URL}/dashboard/analytics" class="cta-button">
          View Full Dashboard
        </a>
      </div>
    </div>
    
    <div class="footer">
      <p>This is an automated report from LiveMart Analytics</p>
      <p>To manage your report preferences, visit your dashboard</p>
    </div>
  </div>
</body>
</html>
  `;
}

// Generate plain text version
function generateWeeklySummaryText(retailerName: string, summary: any, topSKUs: any[], complaints: any): string {
  const {
    total_orders = 0,
    total_revenue = 0,
    total_reviews = 0,
    avg_rating = 0,
    avg_nps_score = 0
  } = summary.overview || {};
  
  return `
Weekly Performance Report for ${retailerName}
Period: ${summary.period?.start_date} to ${summary.period?.end_date}

OVERVIEW
--------
Total Orders: ${total_orders}
Total Revenue: $${parseFloat(total_revenue).toFixed(2)}
Average Rating: ${avg_rating ? avg_rating.toFixed(1) : 'N/A'} stars
NPS Score: ${avg_nps_score ? avg_nps_score.toFixed(0) : '0'}

TOP PERFORMING PRODUCTS
-----------------------
${topSKUs.map((sku, i) => `${i + 1}. ${sku.product_name}
   Units Sold: ${sku.total_units_sold}
   Revenue: $${parseFloat(sku.total_revenue).toFixed(2)}
   Rating: ${sku.avg_rating ? sku.avg_rating.toFixed(1) : 'N/A'} stars
`).join('\n')}

${complaints && Object.values(complaints).some((v: any) => v > 0) ? `
CUSTOMER COMPLAINTS
-------------------
Quality Issues: ${complaints.quality_issues || 0}
Delivery Issues: ${complaints.delivery_issues || 0}
Packaging Issues: ${complaints.packaging_issues || 0}
Price Issues: ${complaints.price_issues || 0}
Service Issues: ${complaints.service_issues || 0}
` : 'No complaints reported this week!'}

View your full dashboard at: ${SUPABASE_URL}/dashboard/analytics

---
This is an automated report from LiveMart Analytics
  `.trim();
}

// Process weekly email for a retailer
async function processWeeklyEmail(subscription: any) {
  console.log(`Processing weekly email for ${subscription.subscriber_email}`);
  
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    // Get performance summary
    const { data: summary, error: summaryError } = await supabase
      .rpc('get_retailer_performance_summary', {
        p_retailer_id: subscription.retailer_id,
        p_start_date: startDateStr,
        p_end_date: endDate
      });
    
    if (summaryError) throw summaryError;
    
    // Get top SKUs
    const { data: topSKUs, error: skuError } = await supabase
      .rpc('get_top_skus', {
        p_retailer_id: subscription.retailer_id,
        p_start_date: startDateStr,
        p_end_date: endDate,
        p_limit: 5,
        p_order_by: 'revenue'
      });
    
    if (skuError) throw skuError;
    
    // Get complaints
    const { data: complaints, error: complaintsError } = await supabase
      .from('retailer_complaints')
      .select('*')
      .eq('retailer_id', subscription.retailer_id)
      .gte('period_start', startDateStr)
      .lte('period_end', endDate)
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    // Generate email content
    const retailerName = subscription.subscriber_name || subscription.subscriber_email;
    const htmlContent = generateWeeklySummaryHTML(retailerName, summary, topSKUs || [], complaints);
    const textContent = generateWeeklySummaryText(retailerName, summary, topSKUs || [], complaints);
    
    // Send email
    const result = await sendEmail(
      subscription.subscriber_email,
      `📊 Your Weekly Performance Report - ${startDateStr} to ${endDate}`,
      htmlContent,
      textContent
    );
    
    if (result.success) {
      console.log(`✓ Email sent successfully to ${subscription.subscriber_email}`);
      return { success: true, email: subscription.subscriber_email };
    } else {
      console.error(`✗ Failed to send email to ${subscription.subscriber_email}:`, result.error);
      return { success: false, email: subscription.subscriber_email, error: result.error };
    }
    
  } catch (error: any) {
    console.error(`Error processing email for ${subscription.subscriber_email}:`, error);
    return { success: false, email: subscription.subscriber_email, error: error.message };
  }
}

// Main weekly email job
async function runWeeklyEmailJob() {
  console.log('=== Starting Weekly Email Job ===');
  console.log(`Time: ${new Date().toISOString()}`);
  
  const startTime = Date.now();
  
  try {
    // Get all active weekly subscriptions
    const { data: subscriptions, error } = await supabase
      .from('report_subscriptions')
      .select('*')
      .eq('active', true)
      .eq('weekly_reports', true)
      .eq('send_via_email', true);
    
    if (error) throw error;
    
    console.log(`Found ${subscriptions?.length || 0} subscriptions to process`);
    
    const results = [];
    for (const subscription of subscriptions || []) {
      const result = await processWeeklyEmail(subscription);
      results.push(result);
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const successCount = results.filter(r => r.success).length;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n=== Weekly Email Job Completed in ${duration}s ===`);
    console.log(`Success: ${successCount}/${results.length}`);
    
    return results;
    
  } catch (error) {
    console.error('Fatal error in weekly email job:', error);
    throw error;
  }
}

// Main execution
async function main() {
  console.log('Weekly Email Report Worker (Node.js) started');
  
  const runOnce = process.env.EMAIL_RUN_ONCE === 'true';
  const interval = parseInt(process.env.EMAIL_INTERVAL_MS || '604800000'); // 7 days
  
  if (runOnce) {
    console.log('Running once');
    await runWeeklyEmailJob();
    process.exit(0);
  } else {
    console.log(`Running in continuous mode (interval: ${interval}ms)`);
    
    // Run immediately
    await runWeeklyEmailJob();
    
    // Then run on schedule
    setInterval(async () => {
      await runWeeklyEmailJob();
    }, interval);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
