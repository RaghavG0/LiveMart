import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

// Send email using Resend API directly
const sendEmail = async (to: string, subject: string, html: string) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Delivery Confirmation <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Email send failed: ${error}`);
  }

  return response.json();
};
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  orderId: string;
  customerEmail: string;
  customerName: string;
}

const generateRandomToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { orderId, customerEmail, customerName }: RequestBody = await req.json();

    if (!orderId || !customerEmail) {
      throw new Error("Missing required fields: orderId, customerEmail");
    }

    console.log(`Generating delivery token for order ${orderId}`);

    // Verify order exists and user is authorized
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, customer_id, seller_id, order_items(product:products(seller_id))")
      .eq("id", orderId)
      .single();

    if (orderError) {
      throw new Error(`Order not found: ${orderError.message}`);
    }

    // Check if user is seller for this order
    const isSeller = order.order_items?.some((item: any) => 
      item.product?.seller_id === user.id
    );

    if (!isSeller && user.id !== order.seller_id) {
      throw new Error("Unauthorized: You are not the seller for this order");
    }

    // Check if order is in appropriate status for delivery confirmation
    const validStatuses = ["processing", "shipped", "out_for_delivery"];
    if (!validStatuses.includes(order.status?.toLowerCase())) {
      throw new Error(`Order status must be one of: ${validStatuses.join(", ")}`);
    }

    // Check for rate limiting - max 3 tokens per hour per order
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentTokens, error: tokenCheckError } = await supabase
      .from("delivery_confirmation_tokens")
      .select("id")
      .eq("order_id", orderId)
      .gte("created_at", oneHourAgo);

    if (tokenCheckError) {
      console.error("Error checking tokens:", tokenCheckError);
    }

    if (recentTokens && recentTokens.length >= 3) {
      throw new Error("Rate limit exceeded: Maximum 3 tokens per hour per order");
    }

    // Generate cryptographically secure random token
    const deliveryToken = generateRandomToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store token in database
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("delivery_confirmation_tokens")
      .insert({
        order_id: orderId,
        token: deliveryToken,
        expires_at: expiresAt.toISOString(),
        used: false,
      })
      .select()
      .single();

    if (tokenError) {
      console.error("Error storing token:", tokenError);
      throw new Error("Failed to generate delivery token");
    }

    console.log("Token stored successfully:", tokenRecord.id);

    // Create confirmation URL
    const confirmationUrl = `https://cdvhodymzfwdzfeltmsu.supabase.co/orders/confirm-delivery?token=${deliveryToken}`;

    // Send email using Resend
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Confirm Your Delivery</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">📦 Delivery Confirmation</h1>
          </div>
          
          <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Hello <strong>${customerName}</strong>,
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Your order is out for delivery! Once you've received your items, please confirm the delivery using the button below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${confirmationUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                ✓ Confirm Delivery
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-bottom: 15px;">
              Or copy and paste this link into your browser:
            </p>
            <p style="font-size: 12px; color: #667eea; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">
              ${confirmationUrl}
            </p>
            
            <div style="margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 6px; border-left: 4px solid #667eea;">
              <p style="margin: 0; font-size: 14px;">
                <strong>💡 What happens next?</strong>
              </p>
              <ul style="margin: 10px 0 0 0; padding-left: 20px; font-size: 14px; color: #666;">
                <li>Confirm your delivery within 24 hours</li>
                <li>Share feedback about your order</li>
                <li>Rate your experience (optional)</li>
              </ul>
            </div>
            
            <p style="font-size: 13px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              This link will expire in 24 hours and can only be used once. If you didn't place this order, please ignore this email.
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
            <p style="margin: 5px 0;">Order ID: ${orderId.slice(0, 8)}</p>
            <p style="margin: 5px 0;">Need help? Contact support</p>
          </div>
        </body>
      </html>
    `;

    try {
      const emailResponse = await sendEmail(
        customerEmail,
        "📦 Confirm Your Delivery",
        emailHtml
      );

      console.log("Email sent successfully:", emailResponse);
    } catch (emailError: any) {
      console.error("Email send error:", emailError);
      // Don't fail the request if email fails - token is still valid
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Delivery confirmation link sent successfully",
        token: deliveryToken, // For testing purposes
        expiresAt: expiresAt.toISOString(),
        confirmationUrl, // For testing purposes
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in generate-delivery-token:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      {
        status: error.message === "Unauthorized" ? 401 : 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
