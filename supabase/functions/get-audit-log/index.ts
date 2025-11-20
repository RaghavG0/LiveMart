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

    // Parse query parameters
    const url = new URL(req.url);
    const reviewId = url.searchParams.get("reviewId");
    const queueItemId = url.searchParams.get("queueItemId");
    const actorId = url.searchParams.get("actorId");
    const actionType = url.searchParams.get("actionType");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Call database function
    const { data, error } = await supabase.rpc("get_moderation_audit_log", {
      p_review_id: reviewId,
      p_queue_item_id: queueItemId,
      p_actor_id: actorId,
      p_action_type: actionType,
      p_date_from: dateFrom,
      p_date_to: dateTo,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error("Error fetching audit log:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get statistics
    const { data: stats } = await supabase.rpc("get_moderation_audit_log", {
      p_review_id: reviewId,
      p_queue_item_id: queueItemId,
      p_actor_id: actorId,
      p_action_type: actionType,
      p_date_from: dateFrom,
      p_date_to: dateTo,
      p_limit: 10000,
      p_offset: 0,
    });

    const actionCounts = stats?.reduce((acc: any, item: any) => {
      acc[item.action_type] = (acc[item.action_type] || 0) + 1;
      return acc;
    }, {});

    return new Response(
      JSON.stringify({
        auditLog: data || [],
        statistics: {
          total: data?.length || 0,
          actionCounts: actionCounts || {},
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
