import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Package, TrendingDown, User, FileText } from "lucide-react";
import { toast } from "sonner";

interface IssueReport {
  id: string;
  product_id: string;
  retailer_id: string;
  issue_type: string;
  issue_description: string;
  severity: string;
  status: string;
  created_at: string;
  updated_at: string;
  related_order_id?: string;
  product_name?: string;
  retailer_name?: string;
}

interface RetailerInsightData {
  retailer_id: string;
  retailer_name: string;
  total_issues: number;
  active_issues: number;
  resolved_issues: number;
  products_affected: number;
  issue_breakdown: {
    quality: number;
    delivery: number;
    packaging: number;
    quantity: number;
    other: number;
  };
  recent_issues: IssueReport[];
}

interface RetailerInsightsProps {
  wholesalerId: string;
}

export default function RetailerInsights({ wholesalerId }: RetailerInsightsProps) {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<RetailerInsightData[]>([]);
  const [selectedRetailer, setSelectedRetailer] = useState<RetailerInsightData | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [timePeriod, setTimePeriod] = useState("30");

  useEffect(() => {
    fetchRetailerInsights();
  }, [wholesalerId, timePeriod]);

  const fetchRetailerInsights = async () => {
    setLoading(true);
    try {
      const daysAgo = new Date(Date.now() - parseInt(timePeriod) * 24 * 60 * 60 * 1000).toISOString();

      // Fetch all issue reports for this wholesaler
      const { data: issuesData, error: issuesError } = await supabase
        .from("retailer_issue_reports" as any)
        .select(`
          *,
          products!inner(name),
          profiles!retailer_issue_reports_retailer_id_fkey(full_name)
        `)
        .eq("wholesaler_id", wholesalerId)
        .gte("created_at", daysAgo)
        .order("created_at", { ascending: false });

      if (issuesError) throw issuesError;

      // Aggregate data by retailer
      const retailerMap = new Map<string, RetailerInsightData>();

      (issuesData || []).forEach((issue: any) => {
        const retailerId = issue.retailer_id;
        
        if (!retailerMap.has(retailerId)) {
          retailerMap.set(retailerId, {
            retailer_id: retailerId,
            retailer_name: issue.profiles?.full_name || "Unknown Retailer",
            total_issues: 0,
            active_issues: 0,
            resolved_issues: 0,
            products_affected: 0,
            issue_breakdown: {
              quality: 0,
              delivery: 0,
              packaging: 0,
              quantity: 0,
              other: 0,
            },
            recent_issues: [],
          });
        }

        const retailerData = retailerMap.get(retailerId)!;
        retailerData.total_issues++;
        
        if (issue.status === "reported" || issue.status === "investigating") {
          retailerData.active_issues++;
        } else if (issue.status === "resolved") {
          retailerData.resolved_issues++;
        }

        // Count issue types
        if (issue.issue_type in retailerData.issue_breakdown) {
          retailerData.issue_breakdown[issue.issue_type as keyof typeof retailerData.issue_breakdown]++;
        }

        // Add to recent issues
        retailerData.recent_issues.push({
          ...issue,
          product_name: issue.products?.name,
          retailer_name: issue.profiles?.full_name,
        });
      });

      // Count unique products affected per retailer
      retailerMap.forEach((retailerData) => {
        const uniqueProducts = new Set(retailerData.recent_issues.map((i) => i.product_id));
        retailerData.products_affected = uniqueProducts.size;
      });

      // Sort retailers by total issues (most problematic first)
      const sortedInsights = Array.from(retailerMap.values()).sort(
        (a, b) => b.active_issues - a.active_issues || b.total_issues - a.total_issues
      );

      setInsights(sortedInsights);
    } catch (error: any) {
      console.error("Error fetching retailer insights:", error);
      toast.error("Failed to load retailer insights");
    } finally {
      setLoading(false);
    }
  };

  const updateIssueStatus = async (issueId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "resolved") {
        updateData.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("retailer_issue_reports" as any)
        .update(updateData as any)
        .eq("id", issueId);

      if (error) throw error;

      toast.success("Issue status updated");
      fetchRetailerInsights();
      
      // Refresh selected retailer data
      if (selectedRetailer) {
        const updated = insights.find((r) => r.retailer_id === selectedRetailer.retailer_id);
        if (updated) setSelectedRetailer(updated);
      }
    } catch (error: any) {
      console.error("Error updating issue:", error);
      toast.error("Failed to update issue status");
    }
  };

  const getIssueTypeIcon = (type: string) => {
    switch (type) {
      case "quality":
        return "🔍";
      case "delivery":
        return "🚚";
      case "packaging":
        return "📦";
      case "quantity":
        return "🔢";
      default:
        return "❓";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "reported":
        return "bg-red-100 text-red-800";
      case "investigating":
        return "bg-yellow-100 text-yellow-800";
      case "resolved":
        return "bg-green-100 text-green-800";
      case "closed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Retailer-Level Insights</h2>
          <p className="text-muted-foreground">
            Track which retailers report recurring issues for your products
          </p>
        </div>
        <Select value={timePeriod} onValueChange={setTimePeriod}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Time period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="180">Last 6 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Retailers</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.length}</div>
            <p className="text-xs text-muted-foreground">With reported issues</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Issues</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insights.reduce((sum, r) => sum + r.active_issues, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved Issues</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insights.reduce((sum, r) => sum + r.resolved_issues, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Successfully addressed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products Affected</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(insights.flatMap((r) => r.recent_issues.map((i) => i.product_id))).size}
            </div>
            <p className="text-xs text-muted-foreground">Unique SKUs</p>
          </CardContent>
        </Card>
      </div>

      {/* Retailers List */}
      <Card>
        <CardHeader>
          <CardTitle>Retailers with Issues</CardTitle>
          <CardDescription>
            Click on a retailer to see detailed issue breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading retailer insights...</div>
            </div>
          ) : insights.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground">
                No retailer issues found for the selected time period
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {insights.map((retailer) => (
                <div
                  key={retailer.retailer_id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedRetailer(retailer);
                    setShowDetailsDialog(true);
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{retailer.retailer_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {retailer.products_affected} products affected
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {retailer.active_issues}
                      </div>
                      <div className="text-xs text-muted-foreground">Active</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {retailer.resolved_issues}
                      </div>
                      <div className="text-xs text-muted-foreground">Resolved</div>
                    </div>
                    <div className="flex gap-2">
                      {Object.entries(retailer.issue_breakdown)
                        .filter(([_, count]) => count > 0)
                        .map(([type, count]) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {getIssueTypeIcon(type)} {count}
                          </Badge>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Issues Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Issues from {selectedRetailer?.retailer_name}
            </DialogTitle>
            <DialogDescription>
              Detailed breakdown of all reported issues
            </DialogDescription>
          </DialogHeader>

          {selectedRetailer && (
            <div className="space-y-4 py-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{selectedRetailer.total_issues}</div>
                  <div className="text-sm text-muted-foreground">Total Issues</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{selectedRetailer.active_issues}</div>
                  <div className="text-sm text-muted-foreground">Active</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{selectedRetailer.products_affected}</div>
                  <div className="text-sm text-muted-foreground">Products</div>
                </div>
              </div>

              {/* Issue List */}
              <div className="space-y-3">
                <h4 className="font-semibold">Recent Issues</h4>
                {selectedRetailer.recent_issues.map((issue) => (
                  <div key={issue.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={getSeverityColor(issue.severity)}>
                            {issue.severity}
                          </Badge>
                          <Badge className={getStatusColor(issue.status)}>
                            {issue.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {getIssueTypeIcon(issue.issue_type)} {issue.issue_type}
                          </span>
                        </div>
                        <h5 className="font-semibold">{issue.product_name}</h5>
                        <p className="text-sm text-muted-foreground mt-1">
                          {issue.issue_description}
                        </p>
                        <div className="text-xs text-muted-foreground mt-2">
                          Reported: {new Date(issue.created_at).toLocaleDateString()} at{" "}
                          {new Date(issue.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                      {(issue.status === "reported" || issue.status === "investigating") && (
                        <div className="flex gap-2">
                          {issue.status === "reported" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateIssueStatus(issue.id, "investigating");
                              }}
                            >
                              Investigate
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-green-50 hover:bg-green-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateIssueStatus(issue.id, "resolved");
                            }}
                          >
                            Resolve
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
