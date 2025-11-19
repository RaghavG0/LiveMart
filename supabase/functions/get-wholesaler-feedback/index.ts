import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * GET /api/wholesalers/{id}/feedback
 * Returns aggregated SKU feedback data for a wholesaler
 * 
 * Query Parameters:
 * - timePeriod: Number of days to look back (default: 90)
 * - minReviews: Minimum reviews to include product (default: 1)
 * - sortBy: 'rating' | 'reviews' | 'trend' (default: 'rating')
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Parse URL and extract wholesaler ID
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const wholesalerId = pathParts[pathParts.length - 2]; // /api/wholesalers/{id}/feedback

    // Verify user is requesting their own data or is authorized
    if (wholesalerId !== user.id) {
      // Check if user has wholesaler role
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", wholesalerId)
        .single();

      if (!userRoles || userRoles.role !== "wholesaler") {
        throw new Error("Access denied: Not a wholesaler");
      }
    }

    // Parse query parameters
    const timePeriod = parseInt(url.searchParams.get("timePeriod") || "90");
    const minReviews = parseInt(url.searchParams.get("minReviews") || "1");
    const sortBy = url.searchParams.get("sortBy") || "rating";

    // Get aggregated SKU feedback using the database function
    const { data: skuFeedback, error: feedbackError } = await supabase
      .rpc("get_wholesaler_sku_feedback", {
        _wholesaler_id: wholesalerId,
        _time_period_days: timePeriod,
      });

    if (feedbackError) {
      console.error("Feedback error:", feedbackError);
      throw feedbackError;
    }

    // Filter by minimum reviews
    let filteredFeedback = (skuFeedback || []).filter(
      (item: any) => item.total_reviews >= minReviews
    );

    // Apply sorting
    filteredFeedback = filteredFeedback.sort((a: any, b: any) => {
      switch (sortBy) {
        case "reviews":
          return b.total_reviews - a.total_reviews;
        case "trend":
          const trendOrder = { declining: 0, stable: 1, improving: 2 };
          return trendOrder[a.trend as keyof typeof trendOrder] - trendOrder[b.trend as keyof typeof trendOrder];
        case "rating":
        default:
          return a.avg_rating - b.avg_rating; // Ascending (problems first)
      }
    });

    // Get active alerts for this wholesaler
    const { data: alerts, error: alertsError } = await supabase
      .from("sku_performance_alerts")
      .select("*")
      .eq("wholesaler_id", wholesalerId)
      .eq("alert_status", "active")
      .order("created_at", { ascending: false });

    if (alertsError) {
      console.error("Alerts error:", alertsError);
    }

    // Get alert configuration
    const { data: config, error: configError } = await supabase
      .from("wholesaler_alert_config")
      .select("*")
      .eq("wholesaler_id", wholesalerId)
      .single();

    if (configError && configError.code !== "PGRST116") { // Ignore "not found" error
      console.error("Config error:", configError);
    }

    // Enrich feedback data with alert information
    const enrichedFeedback = filteredFeedback.map((item: any) => {
      const relatedAlerts = (alerts || []).filter((alert: any) => alert.product_id === item.product_id);
      
      return {
        ...item,
        has_alerts: relatedAlerts.length > 0,
        active_alerts: relatedAlerts.map((alert: any) => ({
          type: alert.alert_type,
          message: alert.alert_message,
          created_at: alert.created_at,
        })),
        sentiment: item.avg_rating >= 4.0 ? "positive" : item.avg_rating >= 3.0 ? "neutral" : "negative",
      };
    });

    // Calculate summary statistics
    const summary = {
      total_products: enrichedFeedback.length,
      products_with_alerts: enrichedFeedback.filter((item: any) => item.has_alerts).length,
      avg_rating_overall: enrichedFeedback.length > 0
        ? (enrichedFeedback.reduce((sum: number, item: any) => sum + item.avg_rating, 0) / enrichedFeedback.length).toFixed(2)
        : 0,
      total_reviews: enrichedFeedback.reduce((sum: number, item: any) => sum + item.total_reviews, 0),
      positive_products: enrichedFeedback.filter((item: any) => item.sentiment === "positive").length,
      neutral_products: enrichedFeedback.filter((item: any) => item.sentiment === "neutral").length,
      negative_products: enrichedFeedback.filter((item: any) => item.sentiment === "negative").length,
      total_retailers: new Set(
        enrichedFeedback.flatMap((item: any) => 
          item.top_complaint_retailers.map((r: any) => r.retailer_id)
        )
      ).size,
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          products: enrichedFeedback,
          alerts: alerts || [],
          config: config || {
            min_rating_threshold: 3.0,
            negative_review_spike_threshold: 5,
            spike_time_window_days: 7,
            complaint_threshold: 3,
            email_notifications_enabled: true,
          },
          summary,
          metadata: {
            time_period_days: timePeriod,
            min_reviews_filter: minReviews,
            sort_by: sortBy,
          },
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Wholesaler feedback error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Internal server error",
      }),
      {
        status: error?.message?.includes("Unauthorized") ? 401 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
