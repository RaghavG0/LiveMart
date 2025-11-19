import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Support both GET (from email link) and POST (from API)
    let token: string;
    
    if (req.method === "GET") {
      const url = new URL(req.url);
      token = url.searchParams.get("token") || "";
    } else {
      const body = await req.json();
      token = body.token;
    }

    if (!token) {
      throw new Error("Token is required");
    }

    console.log("Confirming delivery with token:", token.slice(0, 8) + "...");

    // Verify token
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("delivery_confirmation_tokens")
      .select("*, orders(*)")
      .eq("token", token)
      .maybeSingle();

    if (tokenError) {
      console.error("Token lookup error:", tokenError);
      throw new Error("Error validating token");
    }

    if (!tokenRecord) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "INVALID_TOKEN",
          message: "Invalid or expired delivery confirmation link",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (tokenRecord.used) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "ALREADY_USED",
          message: "This delivery has already been confirmed",
          usedAt: tokenRecord.used_at,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const expiresAt = new Date(tokenRecord.expires_at);
    const now = new Date();
    
    if (expiresAt < now) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "EXPIRED",
          message: "This delivery confirmation link has expired",
          expiredAt: tokenRecord.expires_at,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Token valid, updating order status...");

    // Update order status to delivered
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({ 
        status: "delivered", 
        updated_at: new Date().toISOString() 
      })
      .eq("id", tokenRecord.order_id)
      .select()
      .single();

    if (updateError) {
      console.error("Order update error:", updateError);
      throw new Error("Failed to update order status");
    }

    console.log("Order updated to delivered:", updatedOrder.id);

    // Mark token as used
    const { error: tokenUpdateError } = await supabase
      .from("delivery_confirmation_tokens")
      .update({ 
        used: true, 
        used_at: new Date().toISOString() 
      })
      .eq("id", tokenRecord.id);

    if (tokenUpdateError) {
      console.error("Failed to mark token as used:", tokenUpdateError);
    }

    // Create order status history entry
    const { error: historyError } = await supabase
      .from("order_status_history")
      .insert({
        order_id: tokenRecord.order_id,
        old_status: tokenRecord.orders.status,
        new_status: "delivered",
        notes: "Confirmed via delivery token",
      });

    if (historyError) {
      console.error("Failed to create history entry:", historyError);
    }

    console.log("Delivery confirmation completed successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Delivery confirmed successfully",
        orderId: tokenRecord.order_id,
        orderDetails: {
          id: updatedOrder.id,
          status: updatedOrder.status,
          deliveryAddress: updatedOrder.delivery_address,
          totalAmount: updatedOrder.total_amount,
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in confirm-delivery:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "Internal server error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
