import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateStatusRequest {
  orderId: string;
  newStatus: string;
  notes?: string;
}

const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'ready_for_pickup', 'picked_up'];

// Exchange refresh token for access token (same as send-login-otp)
const getAccessTokenFromRefreshToken = async (): Promise<string | null> => {
  try {
    const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID");
    const GMAIL_CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET");
    const GMAIL_REFRESH_TOKEN = Deno.env.get("GMAIL_REFRESH_TOKEN");

    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
      console.log("Missing OAuth credentials for refresh token flow");
      return null;
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        refresh_token: GMAIL_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to refresh access token:', {
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const data = await response.json();
    console.log('✓ Successfully obtained access token');
    return data.access_token;
  } catch (error: any) {
    console.error('❌ Error refreshing access token:', error);
    return null;
  }
};

// Send email notification using Gmail API
const sendOrderStatusEmail = async (
  toEmail: string,
  toName: string,
  orderId: string,
  orderStatus: string,
  orderTotal: number,
  trackingLink: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const GMAIL_USER = Deno.env.get("GMAIL_USER") || Deno.env.get("GMAIL_EMAIL");
    const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID");
    const GMAIL_CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET");
    const GMAIL_REFRESH_TOKEN = Deno.env.get("GMAIL_REFRESH_TOKEN");

    // Check for Gmail credentials
    const hasOAuthCredentials = !!(GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN);
    
    if (!hasOAuthCredentials) {
      console.error("❌ Missing Gmail OAuth credentials:", {
        hasClientId: !!GMAIL_CLIENT_ID,
        hasClientSecret: !!GMAIL_CLIENT_SECRET,
        hasRefreshToken: !!GMAIL_REFRESH_TOKEN,
        hasGmailUser: !!GMAIL_USER
      });
      return { success: false, error: "Email credentials not configured. Please set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN environment variables." };
    }

    // Get access token
    console.log("🔄 Attempting to get access token from refresh token...");
    const accessToken = await getAccessTokenFromRefreshToken();
    if (!accessToken) {
      console.error('❌ Failed to obtain access token from refresh token');
      return { success: false, error: "Failed to obtain access token. Please check Gmail OAuth credentials." };
    }
    console.log("✓ Access token obtained successfully");

    // Status colors
    const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
      pending: { bg: '#fef3c7', text: '#92400e', icon: '⏳' },
      confirmed: { bg: '#dbeafe', text: '#1e40af', icon: '✓' },
      processing: { bg: '#e0e7ff', text: '#4338ca', icon: '🔄' },
      shipped: { bg: '#fef3c7', text: '#d97706', icon: '📦' },
      delivered: { bg: '#d1fae5', text: '#065f46', icon: '✅' },
      cancelled: { bg: '#fee2e2', text: '#991b1b', icon: '❌' },
      ready_for_pickup: { bg: '#ddd6fe', text: '#5b21b6', icon: '🏪' },
      picked_up: { bg: '#d1fae5', text: '#065f46', icon: '✅' },
    };

    const statusConfig = statusColors[orderStatus.toLowerCase()] || {
      bg: '#f3f4f6',
      text: '#374151',
      icon: '📋'
    };

    const statusLabel = orderStatus.charAt(0).toUpperCase() + orderStatus.slice(1).replace(/_/g, ' ');

    // Create email HTML
    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">LiveMart Connect</h1>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #1f2937; margin-top: 0;">Order Update: ${statusLabel}</h2>
            
            <p style="color: #4b5563; font-size: 16px;">Hello <strong>${toName}</strong>,</p>
            
            <p style="color: #4b5563; font-size: 16px;">Your order status has been updated:</p>
            
            <div style="margin: 30px 0; padding: 20px; background: ${statusConfig.bg}; border-radius: 8px; border-left: 4px solid ${statusConfig.text};">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 32px;">${statusConfig.icon}</span>
                <div>
                  <div style="font-size: 18px; font-weight: bold; color: ${statusConfig.text};">
                    ${statusLabel}
                  </div>
                  <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                    Order #${orderId.slice(0, 8).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
            
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Order ID:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">#${orderId.slice(0, 8).toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">₹${orderTotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Status:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: ${statusConfig.text};">${statusLabel}</td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingLink}" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Track Your Order
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              If you have any questions or concerns, please don't hesitate to contact our support team.
            </p>
            
            <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
              This is an automated notification. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;

    const message = [
      `To: ${toName} <${toEmail}>`,
      `From: ${GMAIL_USER || 'noreply@livemart.com'} <${GMAIL_USER || 'noreply@livemart.com'}>`,
      `Subject: Order Update: Your order is ${statusLabel}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      ``,
      emailHTML
    ].join('\r\n');
    
    // Gmail API requires base64url encoding
    const encodedMessage = btoa(message)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    console.log(`📧 Sending email to ${toEmail}...`);
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedMessage,
      }),
    });
    
    if (response.ok) {
      const responseData = await response.json();
      console.log(`✓ Order status email sent successfully to ${toEmail}. Message ID: ${responseData.id}`);
      return { success: true };
    } else {
      const errorText = await response.text();
      let errorMessage = `Gmail API error: ${response.status}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
        console.error('❌ Gmail API error details:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
      } catch (e) {
        console.error('❌ Gmail API error (raw):', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 500), // Limit log size
        });
      }
      
      return { success: false, error: errorMessage };
    }
  } catch (error: any) {
    console.error('❌ Exception sending order status email:', {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      name: error.name,
    });
    return { success: false, error: error.message || "Unknown error sending email" };
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with user's auth token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { orderId, newStatus, notes }: UpdateStatusRequest = await req.json();

    // Validate input
    if (!orderId || !newStatus) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: orderId, newStatus' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validStatuses.includes(newStatus)) {
      return new Response(
        JSON.stringify({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client for fetching buyer details
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user is seller for this order and get full order details
    const { data: orderData, error: orderError } = await supabaseClient
      .from('orders')
      .select(`
        id,
        status,
        customer_id,
        seller_id,
        order_type,
        total_amount,
        order_items!inner(
          product:products!inner(seller_id)
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !orderData) {
      console.error('Order verification failed:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is a seller for any product in this order
    const isSeller = orderData.order_items.some(
      (item: any) => item.product?.seller_id === user.id
    );

    if (!isSeller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized to update this order' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update order status
    // The trigger will automatically log the status change to order_status_history
    const { data: updatedOrder, error: updateError } = await supabaseClient
      .from('orders')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Optionally add notes to the status history
    if (notes) {
      const { error: historyError } = await supabaseClient
        .from('order_status_history')
        .update({ notes })
        .eq('order_id', orderId)
        .eq('new_status', newStatus)
        .order('created_at', { ascending: false })
        .limit(1);

      if (historyError) {
        console.error('Failed to add notes to history:', historyError);
      }
    }

    // Send email notification (don't fail status update if email fails)
    let emailSent = false;
    let emailError: string | undefined;

    try {
      // Determine buyer: If order_type is 'retailer', buyer is retailer (customer_id), 
      // If order_type is 'customer', buyer is customer (customer_id)
      // Actually, customer_id is always the buyer, seller_id is who is selling
      const buyerId = orderData.customer_id;
      
      if (buyerId) {
        // Fetch buyer's email and name from profiles and auth.users
        const { data: profileData, error: profileError } = await supabaseServiceClient
          .from('profiles')
          .select('id, full_name')
          .eq('id', buyerId)
          .single();

        // Get email from auth.users using service role client
        let buyerEmail: string | null = null;
        let buyerName: string = 'Customer';

        try {
          const { data: authUserData, error: authError } = await supabaseServiceClient.auth.admin.getUserById(buyerId);
          
          if (authError) {
            console.error('❌ Error fetching auth user:', authError.message);
            // Try alternative: get email from profiles table if it exists
            if (profileData) {
              buyerName = profileData.full_name || 'Customer';
            }
          } else if (authUserData?.user?.email) {
            buyerEmail = authUserData.user.email;
            buyerName = profileData?.full_name || buyerEmail.split('@')[0] || 'Customer';
          } else {
            console.warn('⚠ No email found for user:', buyerId);
          }
        } catch (authErr: any) {
          console.error('❌ Exception fetching buyer email:', authErr.message || authErr);
        }

        if (buyerEmail) {
          // Construct tracking link
          const baseUrl = Deno.env.get('SITE_URL') || 'https://your-domain.com';
          const trackingLink = `${baseUrl}/order-tracking/${orderId}`;

          // Send email notification
          const emailResult = await sendOrderStatusEmail(
            buyerEmail,
            buyerName,
            orderId,
            newStatus,
            orderData.total_amount || 0,
            trackingLink
          );

          emailSent = emailResult.success;
          emailError = emailResult.error;

          if (emailSent) {
            console.log(`✓ Email notification sent to buyer: ${buyerEmail}`);
          } else {
            console.error(`❌ Email notification failed: ${emailError}`);
            emailError = emailError || 'Unknown error sending email';
          }
        } else {
          emailError = 'Buyer email not found';
          console.warn('⚠ Could not send email: Buyer email not found for user:', buyerId);
        }
      }
    } catch (emailException: any) {
      console.error('⚠ Error sending email notification (non-blocking):', emailException);
      emailError = emailException.message;
      // Don't throw - status update should succeed even if email fails
    }

    console.log('Order status updated successfully:', updatedOrder);

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedOrder,
        message: `Order status updated to ${newStatus}${emailSent ? '. Email notification sent.' : emailError ? '. Status updated, but email notification failed.' : ''}`,
        emailSent,
        emailError: emailError || undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in update-order-status function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
