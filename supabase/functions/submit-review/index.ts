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

    const { productId, orderId, rating, comment, imageIds } = await req.json();

    // Validate required fields
    if (!productId) {
      throw new Error("Missing required field: productId");
    }

    // Validate rating
    if (rating === undefined || rating === null) {
      throw new Error("Rating is required");
    }

    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "INVALID_RATING",
          message: "Rating must be between 1 and 5",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Sanitize comment
    const sanitizedComment = comment
      ? comment.replace(/<[^>]*>/g, "").trim().slice(0, 1000)
      : null;

    // Check if review already exists
    let existingReview;
    if (orderId) {
      const { data, error } = await supabase
        .from("reviews")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .eq("order_id", orderId)
        .maybeSingle();

      if (error) throw error;
      existingReview = data;
    } else {
      // For open reviews without order, check if user already reviewed this product
      const { data, error } = await supabase
        .from("reviews")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .is("order_id", null)
        .maybeSingle();

      if (error) throw error;
      existingReview = data;
    }

    // Update or insert review
    const reviewData: any = {
      user_id: user.id,
      product_id: productId,
      rating: ratingNum,
      comment: sanitizedComment,
      edited_at: existingReview ? new Date().toISOString() : null,
    };

    if (orderId) {
      reviewData.order_id = orderId;
    }

    let reviewId: string;

    if (existingReview) {
      // Update existing review
      const { data, error } = await supabase
        .from("reviews")
        .update(reviewData)
        .eq("id", existingReview.id)
        .select("id")
        .single();

      if (error) throw error;
      reviewId = data.id;
    } else {
      // Insert new review
      const { data, error } = await supabase
        .from("reviews")
        .insert(reviewData)
        .select("id")
        .single();

      if (error) throw error;
      reviewId = data.id;
    }

    // Mark images as referenced if provided
    if (imageIds && Array.isArray(imageIds) && imageIds.length > 0) {
      for (const imageId of imageIds) {
        await supabase.rpc("mark_image_referenced", {
          p_image_id: imageId,
          p_table_name: "reviews",
          p_record_id: reviewId,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: existingReview ? "Review updated successfully" : "Review submitted successfully",
        reviewId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error submitting review:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to submit review",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

