import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body = await req.json();
    const {
      queueItemId,
      action,
      reason,
      notes,
      newRating,
      newComment,
      escalationType,
    } = body;

    if (!queueItemId || !action) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let result;

    // Execute moderation action
    switch (action) {
      case "approve":
        const { data: approveData, error: approveError } = await supabase.rpc(
          "approve_feedback",
          {
            p_queue_item_id: queueItemId,
            p_moderator_id: user.id,
            p_notes: notes,
          }
        );
        if (approveError) throw approveError;
        result = approveData;
        break;

      case "reject":
        if (!reason) {
          return new Response(
            JSON.stringify({ error: "Reason required for rejection" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        const { data: rejectData, error: rejectError } = await supabase.rpc(
          "reject_feedback",
          {
            p_queue_item_id: queueItemId,
            p_moderator_id: user.id,
            p_reason: reason,
            p_notes: notes,
          }
        );
        if (rejectError) throw rejectError;
        result = rejectData;
        break;

      case "edit":
        if (!reason) {
          return new Response(
            JSON.stringify({ error: "Reason required for editing" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        const { data: editData, error: editError } = await supabase.rpc(
          "edit_feedback",
          {
            p_queue_item_id: queueItemId,
            p_moderator_id: user.id,
            p_new_rating: newRating,
            p_new_comment: newComment,
            p_reason: reason,
            p_notes: notes,
          }
        );
        if (editError) throw editError;
        result = editData;
        break;

      case "escalate":
        if (!escalationType || !reason) {
          return new Response(
            JSON.stringify({
              error: "Escalation type and reason required",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        const { data: escalateData, error: escalateError } = await supabase.rpc(
          "escalate_feedback",
          {
            p_queue_item_id: queueItemId,
            p_moderator_id: user.id,
            p_escalation_type: escalationType,
            p_reason: reason,
            p_notes: notes,
          }
        );
        if (escalateError) throw escalateError;
        result = escalateData;
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action type" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Moderation error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
