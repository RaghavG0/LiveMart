import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Export utility for SKU performance and complaint data
 * Generates CSV files for download
 */

interface ExportFilters {
  timePeriod?: number; // days
  minRating?: number;
  maxRating?: number;
  includeResolved?: boolean;
  productIds?: string[];
  retailerIds?: string[];
}

/**
 * Convert array of objects to CSV string
 */
function convertToCSV(data: any[], headers: string[]): string {
  if (data.length === 0) return "";

  // Create header row
  const headerRow = headers.join(",");

  // Create data rows
  const dataRows = data.map((row) => {
    return headers
      .map((header) => {
        const value = row[header];
        
        // Handle null/undefined
        if (value === null || value === undefined) return "";
        
        // Handle objects/arrays - stringify them
        if (typeof value === "object") {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        
        // Handle strings with commas or quotes
        if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        
        return value;
      })
      .join(",");
  });

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Trigger browser download of CSV file
 */
function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export SKU Performance data to CSV
 */
export async function exportSKUPerformance(
  wholesalerId: string,
  filters: ExportFilters = {}
): Promise<void> {
  try {
    toast.info("Preparing SKU performance export...");

    const { timePeriod = 90, minRating = 0, maxRating = 5 } = filters;

    // Fetch SKU feedback data
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-wholesaler-feedback/${wholesalerId}/feedback?timePeriod=${timePeriod}`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch SKU data");
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error("API returned error");
    }

    let products = result.data.products;

    // Apply filters
    if (minRating > 0) {
      products = products.filter((p: any) => p.avg_rating >= minRating);
    }
    if (maxRating < 5) {
      products = products.filter((p: any) => p.avg_rating <= maxRating);
    }
    if (filters.productIds && filters.productIds.length > 0) {
      products = products.filter((p: any) => filters.productIds!.includes(p.product_id));
    }

    // Prepare export data
    const exportData = products.map((product: any) => ({
      product_id: product.product_id,
      product_name: product.product_name,
      avg_rating: product.avg_rating.toFixed(2),
      total_reviews: product.total_reviews,
      positive_reviews: product.positive_reviews,
      negative_reviews: product.negative_reviews,
      retailers_count: product.retailers_count,
      recent_issues_count: product.recent_issues_count,
      trend: product.trend,
      sentiment: product.sentiment,
      has_alerts: product.has_alerts ? "Yes" : "No",
      alert_count: product.active_alerts.length,
    }));

    const headers = [
      "product_id",
      "product_name",
      "avg_rating",
      "total_reviews",
      "positive_reviews",
      "negative_reviews",
      "retailers_count",
      "recent_issues_count",
      "trend",
      "sentiment",
      "has_alerts",
      "alert_count",
    ];

    const csv = convertToCSV(exportData, headers);
    const timestamp = new Date().toISOString().split("T")[0];
    downloadCSV(csv, `sku_performance_${timestamp}.csv`);

    toast.success(`Exported ${exportData.length} products to CSV`);
  } catch (error: any) {
    console.error("Export error:", error);
    toast.error("Failed to export SKU performance data");
  }
}

/**
 * Export Retailer Complaint Logs to CSV
 */
export async function exportComplaintLogs(
  wholesalerId: string,
  filters: ExportFilters = {}
): Promise<void> {
  try {
    toast.info("Preparing complaint logs export...");

    const { timePeriod = 90, includeResolved = false } = filters;
    const daysAgo = new Date(Date.now() - timePeriod * 24 * 60 * 60 * 1000).toISOString();

    // Build query
    let query = supabase
      .from("retailer_issue_reports" as any)
      .select(`
        *,
        products!inner(name),
        profiles!retailer_issue_reports_retailer_id_fkey(full_name)
      `)
      .eq("wholesaler_id", wholesalerId)
      .gte("created_at", daysAgo)
      .order("created_at", { ascending: false });

    // Apply filters
    if (!includeResolved) {
      query = query.in("status", ["reported", "investigating"]);
    }
    if (filters.productIds && filters.productIds.length > 0) {
      query = query.in("product_id", filters.productIds);
    }
    if (filters.retailerIds && filters.retailerIds.length > 0) {
      query = query.in("retailer_id", filters.retailerIds);
    }

    const { data: complaints, error } = await query;

    if (error) throw error;

    // Prepare export data
    const exportData = (complaints || []).map((complaint: any) => ({
      issue_id: complaint.id,
      product_name: complaint.products?.name || "Unknown",
      retailer_name: complaint.profiles?.full_name || "Unknown",
      issue_type: complaint.issue_type,
      severity: complaint.severity,
      status: complaint.status,
      description: complaint.issue_description,
      reported_date: new Date(complaint.created_at).toLocaleString(),
      resolved_date: complaint.resolved_at
        ? new Date(complaint.resolved_at).toLocaleString()
        : "N/A",
      days_open: complaint.resolved_at
        ? Math.ceil((new Date(complaint.resolved_at).getTime() - new Date(complaint.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : Math.ceil((Date.now() - new Date(complaint.created_at).getTime()) / (1000 * 60 * 60 * 24)),
    }));

    const headers = [
      "issue_id",
      "product_name",
      "retailer_name",
      "issue_type",
      "severity",
      "status",
      "description",
      "reported_date",
      "resolved_date",
      "days_open",
    ];

    const csv = convertToCSV(exportData, headers);
    const timestamp = new Date().toISOString().split("T")[0];
    downloadCSV(csv, `complaint_logs_${timestamp}.csv`);

    toast.success(`Exported ${exportData.length} complaints to CSV`);
  } catch (error: any) {
    console.error("Export error:", error);
    toast.error("Failed to export complaint logs");
  }
}

/**
 * Export Active Alerts to CSV
 */
export async function exportActiveAlerts(wholesalerId: string): Promise<void> {
  try {
    toast.info("Preparing alerts export...");

    const { data: alerts, error: alertsError } = await supabase
      .from("sku_performance_alerts" as any)
      .select(`
        *,
        products!inner(name)
      `)
      .eq("wholesaler_id", wholesalerId)
      .in("alert_status", ["active", "acknowledged"])
      .order("created_at", { ascending: false });

    if (alertsError) throw alertsError;

    const exportData = (alerts || []).map((alert: any) => ({
      alert_id: alert.id,
      product_name: alert.products?.name || "Unknown",
      alert_type: alert.alert_type,
      threshold_value: alert.threshold_value,
      current_value: alert.current_value,
      affected_retailers: alert.affected_retailers_count,
      status: alert.alert_status,
      message: alert.alert_message,
      created_date: new Date(alert.created_at).toLocaleString(),
      acknowledged_date: alert.acknowledged_at
        ? new Date(alert.acknowledged_at).toLocaleString()
        : "N/A",
      days_active: Math.ceil((Date.now() - new Date(alert.created_at).getTime()) / (1000 * 60 * 60 * 24)),
    }));

    const headers = [
      "alert_id",
      "product_name",
      "alert_type",
      "threshold_value",
      "current_value",
      "affected_retailers",
      "status",
      "message",
      "created_date",
      "acknowledged_date",
      "days_active",
    ];

    const csv = convertToCSV(exportData, headers);
    const timestamp = new Date().toISOString().split("T")[0];
    downloadCSV(csv, `active_alerts_${timestamp}.csv`);

    toast.success(`Exported ${exportData.length} alerts to CSV`);
  } catch (error: any) {
    console.error("Export error:", error);
    toast.error("Failed to export alerts");
  }
}

/**
 * Export Complete Dashboard Report (all data combined)
 */
export async function exportCompleteReport(
  wholesalerId: string,
  filters: ExportFilters = {}
): Promise<void> {
  try {
    toast.info("Generating complete report...");

    // Run all exports in parallel
    await Promise.all([
      exportSKUPerformance(wholesalerId, filters),
      exportComplaintLogs(wholesalerId, filters),
      exportActiveAlerts(wholesalerId),
    ]);

    toast.success("Complete report exported successfully");
  } catch (error: any) {
    console.error("Export error:", error);
    toast.error("Failed to export complete report");
  }
}
