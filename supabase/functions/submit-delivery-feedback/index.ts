import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const {
      orderId,
      productQualityRating,
      deliveryServiceRating,
      productFeedback,
      deliveryFeedback,
    } = await req.json();

    // Validate required fields
    if (!orderId) {
      throw new Error("Missing required field: orderId");
    }

    // Validate that at least one rating is provided
    if (!productQualityRating && !deliveryServiceRating) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "MISSING_RATINGS",
          message: "Please provide at least one rating (product quality or delivery service)",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate ratings if provided
    if (productQualityRating && (productQualityRating < 1 || productQualityRating > 5)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "INVALID_RATING",
          message: "Product quality rating must be between 1 and 5",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (deliveryServiceRating && (deliveryServiceRating < 1 || deliveryServiceRating > 5)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "INVALID_RATING",
          message: "Delivery service rating must be between 1 and 5",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify order belongs to user and is delivered
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, customer_id")
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .eq("status", "delivered")
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "INVALID_ORDER",
          message: "Order not found or not delivered",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Sanitize feedback text
    const sanitizedProductFeedback = productFeedback
      ? productFeedback.replace(/<[^>]*>/g, "").trim().slice(0, 1000)
      : null;

    const sanitizedDeliveryFeedback = deliveryFeedback
      ? deliveryFeedback.replace(/<[^>]*>/g, "").trim().slice(0, 1000)
      : null;

    // Insert or update delivery feedback
    const feedbackData: any = {
      order_id: orderId,
      user_id: user.id,
      product_quality_rating: productQualityRating || null,
      delivery_service_rating: deliveryServiceRating || null,
      product_feedback: sanitizedProductFeedback,
      delivery_feedback: sanitizedDeliveryFeedback,
    };

    const { data: existingFeedback } = await supabase
      .from("delivery_feedback")
      .select("id")
      .eq("order_id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();

    let feedbackId: string;

    if (existingFeedback) {
      // Update existing feedback
      const { data, error } = await supabase
        .from("delivery_feedback")
        .update(feedbackData)
        .eq("id", existingFeedback.id)
        .select("id")
        .single();

      if (error) throw error;
      feedbackId = data.id;
    } else {
      // Insert new feedback
      const { data, error } = await supabase
        .from("delivery_feedback")
        .insert(feedbackData)
        .select("id")
        .single();

      if (error) throw error;
      feedbackId = data.id;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Delivery feedback submitted successfully",
        feedbackId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error submitting delivery feedback:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to submit delivery feedback",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

