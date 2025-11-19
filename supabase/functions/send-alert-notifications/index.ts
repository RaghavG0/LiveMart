import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge Function: Send Email Alerts for SKU Performance Issues
 * 
 * This function is triggered by:
 * 1. Scheduled cron job (every 6 hours)
 * 2. Manual trigger when new alerts are created
 * 
 * Sends email notifications to wholesalers when:
 * - New alerts are created (low rating, negative spike, high complaints)
 * - Existing alerts remain unacknowledged for >24 hours
 */

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

// Send email using a mail service (placeholder - integrate with actual service)
async function sendEmail(payload: EmailPayload): Promise<boolean> {
  // TODO: Integrate with actual email service (SendGrid, AWS SES, Resend, etc.)
  // For now, log the email that would be sent
  console.log("📧 Email to send:", {
    to: payload.to,
    subject: payload.subject,
    bodyLength: payload.html.length,
  });

  // In production, uncomment and configure your email service:
  /*
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("SENDGRID_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: payload.to }] }],
      from: { email: "alerts@livemart.com", name: "Live Mart Alerts" },
      subject: payload.subject,
      content: [{ type: "text/html", value: payload.html }],
    }),
  });

  return response.ok;
  */

  // Simulate successful send for now
  return true;
}

function generateAlertEmailHTML(
  wholesalerName: string,
  alerts: any[],
  dashboardUrl: string
): string {
  const criticalAlerts = alerts.filter((a) => a.alert_type === "low_rating" && a.current_value < 2.5);
  const warningAlerts = alerts.filter((a) => !criticalAlerts.includes(a));

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .alert-box { margin: 15px 0; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b; }
    .alert-critical { border-left-color: #dc2626; background: #fef2f2; }
    .alert-warning { border-left-color: #f59e0b; background: #fffbeb; }
    .alert-title { font-weight: bold; margin-bottom: 8px; }
    .alert-details { font-size: 14px; color: #666; }
    .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .stats { display: flex; justify-content: space-around; margin: 20px 0; }
    .stat-item { text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: #667eea; }
    .stat-label { font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Product Performance Alert</h1>
      <p>Action Required: Some of your products need attention</p>
    </div>
    <div class="content">
      <p>Hello ${wholesalerName},</p>
      <p>We've detected ${alerts.length} product performance issue${alerts.length !== 1 ? 's' : ''} that require your attention:</p>

      <div class="stats">
        <div class="stat-item">
          <div class="stat-value">${criticalAlerts.length}</div>
          <div class="stat-label">Critical</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${warningAlerts.length}</div>
          <div class="stat-label">Warning</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${alerts.length}</div>
          <div class="stat-label">Total Alerts</div>
        </div>
      </div>

      ${
        criticalAlerts.length > 0
          ? `
        <h3 style="color: #dc2626;">🚨 Critical Alerts</h3>
        ${criticalAlerts
          .map(
            (alert) => `
        <div class="alert-box alert-critical">
          <div class="alert-title">${alert.product_name}</div>
          <div class="alert-details">
            ${alert.alert_message}<br>
            <strong>Current Value:</strong> ${alert.current_value.toFixed(2)}<br>
            <strong>Threshold:</strong> ${alert.threshold_value.toFixed(2)}<br>
            <strong>Retailers Affected:</strong> ${alert.affected_retailers_count}
          </div>
        </div>
        `
          )
          .join("")}
      `
          : ""
      }

      ${
        warningAlerts.length > 0
          ? `
        <h3 style="color: #f59e0b;">⚠️ Warning Alerts</h3>
        ${warningAlerts
          .slice(0, 5)
          .map(
            (alert) => `
        <div class="alert-box alert-warning">
          <div class="alert-title">${alert.product_name}</div>
          <div class="alert-details">
            ${alert.alert_message}<br>
            <strong>Current Value:</strong> ${alert.current_value.toFixed(2)}<br>
            <strong>Threshold:</strong> ${alert.threshold_value.toFixed(2)}
          </div>
        </div>
        `
          )
          .join("")}
        ${warningAlerts.length > 5 ? `<p><em>...and ${warningAlerts.length - 5} more</em></p>` : ""}
      `
          : ""
      }

      <p>
        <a href="${dashboardUrl}" class="button">View Dashboard & Take Action</a>
      </p>

      <h3>Recommended Actions:</h3>
      <ul>
        <li>Review product quality and specifications</li>
        <li>Contact affected retailers for feedback</li>
        <li>Investigate supply chain issues</li>
        <li>Update product listings if needed</li>
        <li>Consider temporary discounts or promotions</li>
      </ul>

      <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 14px; color: #666;">
        <strong>Note:</strong> You're receiving this email because you have email notifications enabled in your alert configuration.
        You can adjust your notification preferences in the dashboard settings.
      </p>
    </div>
    <div class="footer">
      <p>© 2025 Live Mart Connect. All rights reserved.</p>
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all wholesalers with email notifications enabled
    const { data: configs, error: configError } = await supabase
      .from("wholesaler_alert_config")
      .select("*")
      .eq("email_notifications_enabled", true)
      .not("notification_email", "is", null);

    if (configError) throw configError;

    if (!configs || configs.length === 0) {
      console.log("No wholesalers with email notifications enabled");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No notifications to send",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    let totalEmailsSent = 0;
    const results = [];

    // Process each wholesaler
    for (const config of configs) {
      try {
        // Get active alerts for this wholesaler
        const { data: alerts, error: alertsError } = await supabase
          .from("sku_performance_alerts")
          .select(`
            *,
            products!inner(name)
          `)
          .eq("wholesaler_id", config.wholesaler_id)
          .eq("alert_status", "active")
          .order("created_at", { ascending: false });

        if (alertsError) throw alertsError;

        // Only send email if there are active alerts
        if (!alerts || alerts.length === 0) {
          results.push({
            wholesaler_id: config.wholesaler_id,
            status: "skipped",
            reason: "no_active_alerts",
          });
          continue;
        }

        // Enrich alerts with product names
        const enrichedAlerts = alerts.map((alert) => ({
          ...alert,
          product_name: alert.products?.name || "Unknown Product",
        }));

        // Get wholesaler profile for name
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", config.wholesaler_id)
          .single();

        const wholesalerName = profile?.full_name || "Valued Partner";
        const dashboardUrl = `${supabaseUrl.replace(/\/.*$/, "")}/dashboard/wholesaler`;

        // Generate and send email
        const emailHTML = generateAlertEmailHTML(wholesalerName, enrichedAlerts, dashboardUrl);

        const emailSent = await sendEmail({
          to: config.notification_email,
          subject: `⚠️ ${enrichedAlerts.length} Product Alert${enrichedAlerts.length !== 1 ? "s" : ""} - Action Required`,
          html: emailHTML,
        });

        if (emailSent) {
          totalEmailsSent++;
          results.push({
            wholesaler_id: config.wholesaler_id,
            status: "sent",
            alert_count: enrichedAlerts.length,
            email: config.notification_email,
          });
        } else {
          results.push({
            wholesaler_id: config.wholesaler_id,
            status: "failed",
            reason: "email_send_failed",
          });
        }
      } catch (error: any) {
        console.error(`Error processing wholesaler ${config.wholesaler_id}:`, error);
        results.push({
          wholesaler_id: config.wholesaler_id,
          status: "error",
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emails_sent: totalEmailsSent,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Alert notification error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
