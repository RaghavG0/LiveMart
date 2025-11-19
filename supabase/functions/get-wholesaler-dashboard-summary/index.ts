import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * GET /api/wholesalers/{id}/dashboard/summary
 * Returns dashboard summary metrics for wholesaler
 * 
 * Includes:
 * - Active alerts count
 * - Products needing attention
 * - Recent order metrics
 * - Retailer performance summary
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
    const wholesalerId = pathParts[pathParts.length - 3]; // /api/wholesalers/{id}/dashboard/summary

    // Verify authorization
    if (wholesalerId !== user.id) {
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", wholesalerId)
        .single();

      if (!userRoles || userRoles.role !== "wholesaler") {
        throw new Error("Access denied");
      }
    }

    // Get active alerts count
    const { data: alerts, count: alertsCount } = await supabase
      .from("sku_performance_alerts")
      .select("*", { count: "exact" })
      .eq("wholesaler_id", wholesalerId)
      .eq("alert_status", "active");

    // Get products needing attention (with recent issues)
    const { data: recentIssues, count: issuesCount } = await supabase
      .from("retailer_issue_reports")
      .select("product_id", { count: "exact" })
      .eq("wholesaler_id", wholesalerId)
      .in("status", ["reported", "investigating"])
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    // Get unique products with issues
    const productsNeedingAttention = new Set(
      (recentIssues || []).map((issue: any) => issue.product_id)
    ).size;

    // Get recent order metrics (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentOrders, count: ordersCount } = await supabase
      .from("orders")
      .select("total_amount, status", { count: "exact" })
      .eq("seller_id", wholesalerId)
      .eq("order_type", "retailer")
      .gte("created_at", thirtyDaysAgo);

    const orderMetrics = {
      total_orders: ordersCount || 0,
      total_revenue: (recentOrders || []).reduce((sum: number, order: any) => sum + order.total_amount, 0),
      pending_orders: (recentOrders || []).filter((o: any) => o.status === "pending").length,
      delivered_orders: (recentOrders || []).filter((o: any) => o.status === "delivered").length,
      cancelled_orders: (recentOrders || []).filter((o: any) => o.status === "cancelled").length,
    };

    // Get unique retailers (from all orders)
    const { data: allOrders } = await supabase
      .from("orders")
      .select("customer_id")
      .eq("seller_id", wholesalerId)
      .eq("order_type", "retailer");

    const uniqueRetailers = new Set(
      (allOrders || []).map((order: any) => order.customer_id)
    ).size;

    // Get active retailers (ordered in last 30 days)
    const activeRetailers = new Set(
      (recentOrders || []).map((order: any) => order.customer_id)
    ).size;

    // Get SKU feedback summary using the function
    const { data: skuFeedback } = await supabase.rpc("get_wholesaler_sku_feedback", {
      _wholesaler_id: wholesalerId,
      _time_period_days: 30,
    });

    const feedbackSummary = {
      total_products_with_reviews: (skuFeedback || []).length,
      avg_rating: skuFeedback && skuFeedback.length > 0
        ? (skuFeedback.reduce((sum: number, item: any) => sum + item.avg_rating, 0) / skuFeedback.length).toFixed(2)
        : 0,
      total_reviews: (skuFeedback || []).reduce((sum: number, item: any) => sum + item.total_reviews, 0),
      products_trending_down: (skuFeedback || []).filter((item: any) => item.trend === "declining").length,
    };

    // Get alert breakdown by type
    const alertBreakdown = {
      low_rating: (alerts || []).filter((a: any) => a.alert_type === "low_rating").length,
      negative_spike: (alerts || []).filter((a: any) => a.alert_type === "negative_spike").length,
      complaint_threshold: (alerts || []).filter((a: any) => a.alert_type === "complaint_threshold").length,
    };

    // Get top 5 problem products
    const topProblemProducts = (skuFeedback || [])
      .filter((item: any) => item.avg_rating < 3.5 || item.recent_issues_count > 0)
      .sort((a: any, b: any) => {
        // Sort by combination of low rating and issue count
        const scoreA = (5 - a.avg_rating) * 10 + a.recent_issues_count;
        const scoreB = (5 - b.avg_rating) * 10 + b.recent_issues_count;
        return scoreB - scoreA;
      })
      .slice(0, 5)
      .map((item: any) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        avg_rating: item.avg_rating,
        total_reviews: item.total_reviews,
        recent_issues: item.recent_issues_count,
        retailers_affected: item.retailers_count,
      }));

    // Get retailer performance insights
    const { data: retailerIssues } = await supabase
      .from("retailer_issue_reports")
      .select("retailer_id, severity")
      .eq("wholesaler_id", wholesalerId)
      .in("status", ["reported", "investigating"])
      .gte("created_at", thirtyDaysAgo);

    // Count issues per retailer
    const retailerIssueMap = new Map<string, number>();
    (retailerIssues || []).forEach((issue: any) => {
      const count = retailerIssueMap.get(issue.retailer_id) || 0;
      retailerIssueMap.set(issue.retailer_id, count + 1);
    });

    // Get top retailers with complaints
    const topRetailersWithComplaints = Array.from(retailerIssueMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([retailer_id, count]) => ({
        retailer_id,
        complaint_count: count,
      }));

    // Fetch retailer names
    if (topRetailersWithComplaints.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", topRetailersWithComplaints.map((r) => r.retailer_id));

      topRetailersWithComplaints.forEach((retailer) => {
        const profile = (profiles || []).find((p: any) => p.id === retailer.retailer_id);
        if (profile) {
          (retailer as any).retailer_name = profile.full_name;
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          alerts: {
            total_active: alertsCount || 0,
            breakdown: alertBreakdown,
            critical_products: topProblemProducts,
          },
          orders: {
            ...orderMetrics,
            avg_order_value: orderMetrics.total_orders > 0
              ? (orderMetrics.total_revenue / orderMetrics.total_orders).toFixed(2)
              : 0,
          },
          retailers: {
            total_retailers: uniqueRetailers,
            active_last_30_days: activeRetailers,
            top_complainers: topRetailersWithComplaints,
          },
          feedback: feedbackSummary,
          quality_metrics: {
            products_needing_attention: productsNeedingAttention,
            recent_issues_count: issuesCount || 0,
            products_below_threshold: alertBreakdown.low_rating,
            negative_review_spikes: alertBreakdown.negative_spike,
          },
          timestamp: new Date().toISOString(),
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Dashboard summary error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Internal server error",
      }),
      {
        status: error?.message?.includes("Unauthorized") || error?.message?.includes("Access denied") ? 401 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
