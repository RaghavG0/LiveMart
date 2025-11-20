import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple rate limiting with in-memory store (use Redis for production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const checkRateLimit = (userId: string, maxRequests = 5, windowMs = 60000): boolean => {
  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (userLimit.count >= maxRequests) {
    return false;
  }

  userLimit.count++;
  return true;
};

// Sanitize user input to prevent XSS
const sanitizeInput = (input: string, maxLength: number): string => {
  if (!input) return "";
  // Remove HTML tags and trim
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
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

    // Rate limiting check
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again in a minute.",
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { productId, orderId, rating, comment, imageIds } = await req.json();

    console.log("Submit feedback request:", { productId, orderId, rating, imageIds, userId: user.id });

    // Validate required fields
    if (!productId || !orderId) {
      throw new Error("Missing required fields: productId, orderId");
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

    // Sanitize comment input
    const sanitizedComment = comment ? sanitizeInput(comment, 1000) : null;

    // Validate comment length
    if (sanitizedComment && sanitizedComment.length > 1000) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "COMMENT_TOO_LONG",
          message: "Comment must be less than 1000 characters",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate imageIds if provided
    if (imageIds && (!Array.isArray(imageIds) || imageIds.length > 3)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "INVALID_IMAGES",
          message: "Maximum 3 images allowed per review",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify order exists and belongs to user
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, customer_id, status")
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (orderError) {
      console.error("Order lookup error:", orderError);
      throw new Error("Error verifying order");
    }

    if (!order) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "ORDER_NOT_FOUND",
          message: "Order not found or you don't have permission to review it",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify order is delivered
    if (order.status !== "delivered") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "ORDER_NOT_DELIVERED",
          message: "You can only review delivered orders",
          currentStatus: order.status,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify product is in the order
    const { data: orderItem, error: itemError } = await supabase
      .from("order_items")
      .select("id")
      .eq("order_id", orderId)
      .eq("product_id", productId)
      .maybeSingle();

    if (itemError) {
      console.error("Order item lookup error:", itemError);
      throw new Error("Error verifying product in order");
    }

    if (!orderItem) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "PRODUCT_NOT_IN_ORDER",
          message: "This product was not part of your order",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if review already exists (ONE REVIEW PER ORDER-PRODUCT)
    const { data: existingReview, error: reviewCheckError } = await supabase
      .from("reviews")
      .select("id, rating, comment, created_at")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .eq("order_id", orderId)
      .maybeSingle();

    if (reviewCheckError) {
      console.error("Review check error:", reviewCheckError);
    }

    let result;
    let isUpdate = false;

    if (existingReview) {
      // Update existing review
      console.log("Updating existing review:", existingReview.id);
      
      const updateData: any = {
        rating: ratingNum,
        comment: sanitizedComment,
        edited_at: new Date().toISOString(),
      };

      // Add media_urls if imageIds provided
      if (imageIds && imageIds.length > 0) {
        updateData.media_urls = imageIds;
      }
      
      const { data, error } = await supabase
        .from("reviews")
        .update(updateData)
        .eq("id", existingReview.id)
        .select()
        .single();

      if (error) {
        console.error("Review update error:", error);
        throw new Error("Failed to update review");
      }
      
      result = data;
      isUpdate = true;
    } else {
      // Create new review
      console.log("Creating new review");
      
      const insertData: any = {
        user_id: user.id,
        product_id: productId,
        order_id: orderId,
        rating: ratingNum,
        comment: sanitizedComment,
      };

      // Add media_urls if imageIds provided
      if (imageIds && imageIds.length > 0) {
        insertData.media_urls = imageIds;
      }
      
      const { data, error } = await supabase
        .from("reviews")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error("Review creation error:", error);
        throw new Error("Failed to create review");
      }
      
      result = data;
      isUpdate = false;
    }

    console.log(
      isUpdate 
        ? `Review updated successfully: ${result.id}`
        : `Review created successfully: ${result.id}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: isUpdate ? "Review updated successfully" : "Review submitted successfully",
        reviewId: result.id,
        data: {
          id: result.id,
          rating: result.rating,
          comment: result.comment,
          media_urls: result.media_urls,
          createdAt: result.created_at,
          editedAt: result.edited_at,
        },
        isUpdate,
      }),
      {
        status: isUpdate ? 200 : 201,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in submit-feedback:", error);
    
    // Check for specific error types
    const is401 = error.message?.includes("Unauthorized") || 
                  error.message?.includes("authorization");
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "Internal server error"
      }),
      {
        status: is401 ? 401 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
