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
    const status = url.searchParams.get("status");
    const productId = url.searchParams.get("productId");
    const reviewerId = url.searchParams.get("reviewerId");
    const minPriority = url.searchParams.get("minPriority");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const minRating = url.searchParams.get("minRating");
    const maxRating = url.searchParams.get("maxRating");
    const flaggedOnly = url.searchParams.get("flaggedOnly") === "true";
    const assignedTo = url.searchParams.get("assignedTo");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Call database function
    const { data, error } = await supabase.rpc("get_moderation_queue", {
      p_status: status,
      p_product_id: productId,
      p_reviewer_id: reviewerId,
      p_min_priority: minPriority ? parseInt(minPriority) : null,
      p_date_from: dateFrom,
      p_date_to: dateTo,
      p_min_rating: minRating ? parseInt(minRating) : null,
      p_max_rating: maxRating ? parseInt(maxRating) : null,
      p_flagged_only: flaggedOnly,
      p_assigned_to: assignedTo,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error("Error fetching moderation queue:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get statistics
    const { data: stats } = await supabase
      .from("moderation_queue")
      .select("status", { count: "exact", head: false });

    const statusCounts = stats?.reduce((acc: any, item: any) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});

    return new Response(
      JSON.stringify({
        queue: data || [],
        statistics: {
          total: data?.length || 0,
          statusCounts: statusCounts || {},
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
