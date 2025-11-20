// Ad-hoc CSV Export API
// Allows retailers to export analytics data for selected date ranges

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

    // Parse query parameters
    const url = new URL(req.url);
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    const reportType = url.searchParams.get("type") || "summary"; // summary, sku_trends, complaints, all
    const retailerId = url.searchParams.get("retailer_id") || user.id;

    // Validate dates
    if (!startDate || !endDate) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required parameters: start_date, end_date"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        }
      );
    }

    // Verify user has access to this retailer's data
    if (retailerId !== user.id) {
      // Check if user is admin
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "admin") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Unauthorized to access this retailer's data"
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          }
        );
      }
    }

    console.log(`Generating CSV export for ${retailerId}: ${reportType} (${startDate} to ${endDate})`);

    // Generate CSV content based on report type
    let csvContent = "";
    let filename = "";

    if (reportType === "summary" || reportType === "all") {
      // Analytics snapshots CSV
      const { data: snapshots, error } = await supabase
        .from("analytics_snapshots")
        .select("*")
        .eq("retailer_id", retailerId)
        .gte("snapshot_date", startDate)
        .lte("snapshot_date", endDate)
        .order("snapshot_date", { ascending: true });

      if (error) throw error;

      const headers = [
        "Date",
        "Total Orders",
        "Total Revenue",
        "Total Reviews",
        "Avg Rating",
        "NPS Score",
        "Promoters",
        "Passives",
        "Detractors",
        "Total Products",
        "Active Products"
      ];

      csvContent = headers.join(",") + "\n";
      
      for (const row of snapshots || []) {
        csvContent += [
          row.snapshot_date,
          row.total_orders,
          row.total_revenue,
          row.total_reviews,
          row.avg_rating || "",
          row.nps_score || "",
          row.promoters_count,
          row.passives_count,
          row.detractors_count,
          row.total_products,
          row.active_products
        ].join(",") + "\n";
      }

      filename = `analytics_${retailerId}_${startDate}_${endDate}.csv`;
    }

    if (reportType === "sku_trends" || reportType === "all") {
      // SKU trends CSV
      const { data: trends, error } = await supabase
        .from("sku_trends")
        .select(`
          trend_date,
          product_id,
          products!inner(name, sku),
          units_sold,
          revenue,
          reviews_count,
          avg_rating,
          rating_trend,
          complaints_count,
          current_stock
        `)
        .eq("retailer_id", retailerId)
        .gte("trend_date", startDate)
        .lte("trend_date", endDate)
        .order("trend_date", { ascending: true })
        .order("revenue", { ascending: false });

      if (error) throw error;

      if (reportType === "all" && csvContent) {
        csvContent += "\n\n"; // Add spacing between sections
      }

      const headers = [
        "Date",
        "Product Name",
        "SKU",
        "Units Sold",
        "Revenue",
        "Reviews",
        "Avg Rating",
        "Rating Trend",
        "Complaints",
        "Current Stock"
      ];

      if (!csvContent) {
        csvContent = headers.join(",") + "\n";
      } else {
        csvContent += "SKU TRENDS\n" + headers.join(",") + "\n";
      }

      for (const row of trends || []) {
        const product = row.products as any;
        csvContent += [
          row.trend_date,
          `"${product?.name || 'Unknown'}"`,
          product?.sku || "",
          row.units_sold,
          row.revenue,
          row.reviews_count,
          row.avg_rating || "",
          row.rating_trend || "",
          row.complaints_count,
          row.current_stock || ""
        ].join(",") + "\n";
      }

      if (reportType === "sku_trends") {
        filename = `sku_trends_${retailerId}_${startDate}_${endDate}.csv`;
      }
    }

    if (reportType === "complaints" || reportType === "all") {
      // Complaints CSV
      const { data: complaints, error } = await supabase
        .from("retailer_complaints")
        .select("*")
        .eq("retailer_id", retailerId)
        .gte("period_start", startDate)
        .lte("period_end", endDate)
        .order("period_start", { ascending: true });

      if (error) throw error;

      if (reportType === "all" && csvContent) {
        csvContent += "\n\n";
      }

      const headers = [
        "Period Start",
        "Period End",
        "Quality Issues",
        "Delivery Issues",
        "Packaging Issues",
        "Price Issues",
        "Service Issues",
        "Other Issues"
      ];

      if (!csvContent) {
        csvContent = headers.join(",") + "\n";
      } else {
        csvContent += "COMPLAINTS\n" + headers.join(",") + "\n";
      }

      for (const row of complaints || []) {
        csvContent += [
          row.period_start,
          row.period_end,
          row.quality_issues,
          row.delivery_issues,
          row.packaging_issues,
          row.price_issues,
          row.service_issues,
          row.other_issues
        ].join(",") + "\n";
      }

      if (reportType === "complaints") {
        filename = `complaints_${retailerId}_${startDate}_${endDate}.csv`;
      }
    }

    if (reportType === "all") {
      filename = `complete_report_${retailerId}_${startDate}_${endDate}.csv`;
    }

    // Return CSV file
    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
        ...corsHeaders
      }
    });

  } catch (error: any) {
    console.error("Error in export-analytics-csv:", error);

    const is401 = error.message?.includes("Unauthorized") || 
                  error.message?.includes("authorization");

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error"
      }),
      {
        status: is401 ? 401 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );
  }
});
