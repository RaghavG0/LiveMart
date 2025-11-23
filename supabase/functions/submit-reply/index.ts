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

    const { reviewId, parentReplyId, replyText, replyType } = await req.json();

    // Validate required fields
    if (!reviewId || !replyText) {
      throw new Error("Missing required fields: reviewId, replyText");
    }

    // Validate reply type
    if (replyType && !["vendor", "user"].includes(replyType)) {
      throw new Error("Invalid replyType. Must be 'vendor' or 'user'");
    }

    // Determine reply type if not provided
    let finalReplyType = replyType;
    if (!finalReplyType) {
      // Check if user is a seller for this product
      const { data: review } = await supabase
        .from("reviews")
        .select("product_id, products!inner(seller_id)")
        .eq("id", reviewId)
        .single();

      if (review && (review as any).products?.seller_id === user.id) {
        finalReplyType = "vendor";
      } else {
        finalReplyType = "user";
      }
    }

    // Sanitize reply text
    const sanitizedText = replyText
      .replace(/<[^>]*>/g, "")
      .trim()
      .slice(0, 2000);

    if (sanitizedText.length < 10) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "INVALID_LENGTH",
          message: "Reply must be at least 10 characters",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Prepare reply data
    const replyData: any = {
      review_id: reviewId,
      reply_text: sanitizedText,
      reply_type: finalReplyType,
    };

    if (parentReplyId) {
      replyData.parent_reply_id = parentReplyId;
    }

    if (finalReplyType === "vendor") {
      replyData.seller_id = user.id;
    } else {
      replyData.user_id = user.id;
    }

    // Insert reply
    const { data, error } = await supabase
      .from("review_replies")
      .insert(replyData)
      .select("id, created_at")
      .single();

    if (error) {
      console.error("Error inserting reply:", error);
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Reply submitted successfully",
        replyId: data.id,
        createdAt: data.created_at,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error submitting reply:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to submit reply",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

