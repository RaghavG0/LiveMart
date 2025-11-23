import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to update stock after transaction
async function updateStockAfterTransaction(
  supabaseClient: any,
  items: Array<{ product_id: string; quantity: number }>
): Promise<{ success: boolean; error?: string }> {
  try {
    for (const item of items) {
      // Decrement stock quantity
      const { error: updateError } = await supabaseClient.rpc('decrement_product_stock', {
        product_uuid: item.product_id,
        quantity_to_decrement: item.quantity,
      });

      if (updateError) {
        // Fallback: Use direct update if RPC doesn't exist
        const { data: productData, error: fetchError } = await supabaseClient
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product_id)
          .single();

        if (fetchError) {
          console.error(`Error fetching product ${item.product_id}:`, fetchError);
          return { success: false, error: `Product ${item.product_id} not found` };
        }

        const newStock = (productData.stock_quantity || 0) - item.quantity;
        if (newStock < 0) {
          return { success: false, error: `Insufficient stock for product ${item.product_id}` };
        }

        const { error: directUpdateError } = await supabaseClient
          .from('products')
          .update({ stock_quantity: newStock })
          .eq('id', item.product_id);

        if (directUpdateError) {
          console.error(`Error updating stock for product ${item.product_id}:`, directUpdateError);
          return { success: false, error: `Failed to update stock for product ${item.product_id}` };
        }
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in updateStockAfterTransaction:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to send calendar reminder email
async function sendCalendarReminder(
  userEmail: string,
  userName: string,
  pickupDate: string,
  pickupTime: string,
  orderId: string
): Promise<boolean> {
  try {
    const GMAIL_ACCESS_TOKEN = Deno.env.get("GMAIL_ACCESS_TOKEN");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SITE_URL = Deno.env.get("SITE_URL") || "https://livemart.com";

    const reminderDate = new Date(`${pickupDate}T${pickupTime}`);
    const formattedDate = reminderDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const emailContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">LiveMart Store Pickup</h1>
          </div>
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #1f2937; margin-top: 0;">Pickup Reminder</h2>
            <p style="color: #4b5563; font-size: 16px;">Hello ${userName},</p>
            <p style="color: #4b5563; font-size: 16px;">This is a reminder about your upcoming store pickup order:</p>
            
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; border: 2px solid #10b981; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #065f46;"><strong>Order ID:</strong> ${orderId.slice(0, 8)}</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #065f46;"><strong>Pickup Date:</strong> ${formattedDate}</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #065f46;"><strong>Pickup Time:</strong> ${pickupTime}</p>
            </div>

            <p style="color: #6b7280; font-size: 14px;">Please remember to pick up your order at the scheduled time.</p>
            
            <div style="margin: 30px 0; text-align: center;">
              <a href="${SITE_URL}/orders" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Order Details
              </a>
            </div>

            <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              If you need to reschedule or have any questions, please contact us.
            </p>
          </div>
        </body>
      </html>
    `;

    // Try Gmail API first
    if (GMAIL_ACCESS_TOKEN) {
      try {
        const message = [
          `To: ${userEmail}`,
          `From: LiveMart <noreply@livemart.com>`,
          `Subject: Store Pickup Reminder - Order ${orderId.slice(0, 8)}`,
          `MIME-Version: 1.0`,
          `Content-Type: text/html; charset=utf-8`,
          ``,
          emailContent
        ].join('\r\n');

        const encodedMessage = btoa(message)
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GMAIL_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            raw: encodedMessage,
          }),
        });

        if (response.ok) {
          console.log(`Calendar reminder sent to ${userEmail} via Gmail API`);
          return true;
        }
      } catch (gmailError) {
        console.error('Gmail API error:', gmailError);
      }
    }

    // Fallback to Resend
    if (RESEND_API_KEY) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "LiveMart <noreply@livemart.com>",
            to: [userEmail],
            subject: `Store Pickup Reminder - Order ${orderId.slice(0, 8)}`,
            html: emailContent,
          }),
        });

        if (response.ok) {
          console.log(`Calendar reminder sent to ${userEmail} via Resend`);
          return true;
        }
      } catch (resendError) {
        console.error('Resend error:', resendError);
      }
    }

    // Development mode - log to console
    console.log(`[MOCK] Calendar reminder email would be sent to ${userEmail}`);
    console.log(`Pickup Date: ${formattedDate}, Time: ${pickupTime}`);
    return true; // Return true in development mode
  } catch (error) {
    console.error("Error sending calendar reminder:", error);
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token from header or Authorization header
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || null;
    
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create client with user token for authenticated requests
    const userSupabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Get user from token
    const { data: { user }, error: userError } = await userSupabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { items, pickup_date, pickup_time, total_amount } = await req.json();

    // Validate inputs
    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Items are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!pickup_date || !pickup_time) {
      return new Response(
        JSON.stringify({ success: false, error: "Pickup date and time are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get seller_id from first product (assuming all products are from same seller)
    const { data: firstProduct } = await supabase
      .from('products')
      .select('seller_id')
      .eq('id', items[0].product_id)
      .single();

    if (!firstProduct) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid product" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get user profile for delivery address
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, location_address')
      .eq('id', user.id)
      .single();

    const deliveryAddress = profile?.location_address || "Store Pickup";

    // Create order with status "pending" (will change to "ready_for_pickup" when seller confirms)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_id: user.id,
        seller_id: firstProduct.seller_id,
        total_amount: total_amount,
        status: "pending",
        order_type: "customer", // Using customer order type for pickup orders
        delivery_address: deliveryAddress,
        notes: `Store Pickup - Date: ${pickup_date}, Time: ${pickup_time}`,
        payment_method: "cash_on_pickup",
        payment_status: "pending",
      })
      .select()
      .single();

    if (orderError) {
      console.error("Error creating order:", orderError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create order" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create order items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price_at_purchase: item.price_at_purchase,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("Error creating order items:", itemsError);
      // Rollback order
      await supabase.from("orders").delete().eq("id", order.id);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create order items" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update stock after successful order creation
    const stockUpdate = await updateStockAfterTransaction(supabase, items);
    if (!stockUpdate.success) {
      console.error("Stock update failed:", stockUpdate.error);
      // Note: We don't rollback the order here, but log the error
      // The seller can manually adjust if needed
    }

    // Create order status history entry
    await supabase.from("order_status_history").insert({
      order_id: order.id,
      new_status: "pending",
      changed_by: user.id,
      notes: "Order placed for store pickup",
    });

    // Schedule calendar reminder (send immediately for testing, or use a scheduler in production)
    const userName = profile?.full_name || user.email || "Customer";
    await sendCalendarReminder(
      user.email || "",
      userName,
      pickup_date,
      pickup_time,
      order.id
    );

    return new Response(
      JSON.stringify({
        success: true,
        orderId: order.id,
        message: "Order created successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in create-offline-pickup-order:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to create order",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
