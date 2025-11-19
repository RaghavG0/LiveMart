import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sanitize input to prevent XSS
const sanitizeInput = (input: string, maxLength: number): string => {
  if (!input) return "";
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

    const url = new URL(req.url);
    const feedbackId = url.pathname.split("/").pop();
    
    if (req.method === "POST" || req.method === "PUT") {
      const { reply } = await req.json();

      if (!reply || reply.trim().length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "INVALID_REPLY",
            message: "Reply cannot be empty",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Sanitize the reply
      const sanitizedReply = sanitizeInput(reply, 2000);

      if (sanitizedReply.length < 10) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "REPLY_TOO_SHORT",
            message: "Reply must be at least 10 characters",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Get the review to verify ownership
      const { data: review, error: reviewError } = await supabase
        .from("reviews")
        .select(`
          id,
          product_id,
          user_id,
          products!inner(seller_id)
        `)
        .eq("id", feedbackId)
        .single();

      if (reviewError || !review) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "REVIEW_NOT_FOUND",
            message: "Review not found",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Verify user is the product seller
      if (review.products.seller_id !== user.id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "UNAUTHORIZED",
            message: "You can only reply to reviews for your own products",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Check if reply already exists
      const { data: existingReply } = await supabase
        .from("review_replies")
        .select("id, created_at")
        .eq("review_id", feedbackId)
        .single();

      const now = new Date().toISOString();

      if (existingReply) {
        // Check if editing is allowed (within 24 hours)
        const createdAt = new Date(existingReply.created_at);
        const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceCreation > 24) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "EDIT_WINDOW_EXPIRED",
              message: "Replies can only be edited within 24 hours",
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }

        // Update existing reply
        const { error: updateError } = await supabase
          .from("review_replies")
          .update({
            reply_text: sanitizedReply,
            edited_at: now,
          })
          .eq("id", existingReply.id);

        if (updateError) throw updateError;

        return new Response(
          JSON.stringify({
            success: true,
            message: "Reply updated successfully",
            replyId: existingReply.id,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      } else {
        // Create new reply
        const { data: newReply, error: insertError } = await supabase
          .from("review_replies")
          .insert({
            review_id: feedbackId,
            seller_id: user.id,
            reply_text: sanitizedReply,
            created_at: now,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // TODO: Create notification for the reviewer
        // This would be handled by a database trigger or separate notification service

        return new Response(
          JSON.stringify({
            success: true,
            message: "Reply submitted successfully",
            replyId: newReply.id,
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    } else if (req.method === "DELETE") {
      // Delete reply
      const { data: reply, error: replyError } = await supabase
        .from("review_replies")
        .select("id, seller_id, created_at")
        .eq("review_id", feedbackId)
        .single();

      if (replyError || !reply) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "REPLY_NOT_FOUND",
            message: "Reply not found",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      if (reply.seller_id !== user.id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "UNAUTHORIZED",
            message: "You can only delete your own replies",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      const { error: deleteError } = await supabase
        .from("review_replies")
        .delete()
        .eq("id", reply.id);

      if (deleteError) throw deleteError;

      return new Response(
        JSON.stringify({
          success: true,
          message: "Reply deleted successfully",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else {
      throw new Error("Method not allowed");
    }
  } catch (error: any) {
    console.error("Reply to feedback error:", error);
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
