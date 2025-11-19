import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, TrendingDown, TrendingUp, Minus, Star, Users, MessageSquare } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { toast } from "sonner";

interface SKUFeedbackData {
  product_id: string;
  product_name: string;
  product_image_url: string | null;
  avg_rating: number;
  total_reviews: number;
  positive_reviews: number;
  negative_reviews: number;
  retailers_count: number;
  top_complaint_retailers: Array<{ retailer_id: string; issue_count: number }>;
  recent_issues_count: number;
  trend: "improving" | "stable" | "declining";
  sentiment: "positive" | "neutral" | "negative";
  has_alerts: boolean;
  active_alerts: Array<{ type: string; message: string; created_at: string }>;
}

interface AggregatedSKUFeedbackProps {
  wholesalerId: string;
}

export default function AggregatedSKUFeedback({ wholesalerId }: AggregatedSKUFeedbackProps) {
  const [loading, setLoading] = useState(true);
  const [skuData, setSKUData] = useState<SKUFeedbackData[]>([]);
  const [timePeriod, setTimePeriod] = useState("90");
  const [sortBy, setSortBy] = useState("rating");
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    fetchSKUFeedback();
  }, [wholesalerId, timePeriod, sortBy]);

  const fetchSKUFeedback = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-wholesaler-feedback/${wholesalerId}/feedback?timePeriod=${timePeriod}&sortBy=${sortBy}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch SKU feedback");
      }

      const result = await response.json();
      if (result.success) {
        setSKUData(result.data.products);
        setSummary(result.data.summary);
      }
    } catch (error: any) {
      console.error("Error fetching SKU feedback:", error);
      toast.error("Failed to load SKU performance data");
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "declining":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "bg-green-100 text-green-800 border-green-200";
      case "neutral":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "negative":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Prepare chart data for rating distribution
  const getRatingDistributionData = () => {
    if (!skuData.length) return [];
    
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    skuData.forEach((sku) => {
      const rating = Math.round(sku.avg_rating);
      if (rating >= 1 && rating <= 5) {
        distribution[rating as keyof typeof distribution]++;
      }
    });

    return Object.entries(distribution).map(([stars, count]) => ({
      stars: `${stars} Stars`,
      count,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">SKU Performance Analytics</h2>
          <p className="text-muted-foreground">
            Track product ratings and reviews across all retailers
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">By Rating</SelectItem>
              <SelectItem value="reviews">By Reviews</SelectItem>
              <SelectItem value="trend">By Trend</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_products}</div>
              <p className="text-xs text-muted-foreground">
                {summary.products_with_alerts} with alerts
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.avg_rating_overall}</div>
              <p className="text-xs text-muted-foreground">
                From {summary.total_reviews} reviews
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Retailers Reached</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_retailers}</div>
              <p className="text-xs text-muted-foreground">Unique retailers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Performance</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {summary.positive_products}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.neutral_products} neutral, {summary.negative_products} negative
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
            <CardDescription>Number of products by average rating</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={getRatingDistributionData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stars" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sentiment Overview</CardTitle>
            <CardDescription>Product performance breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {summary && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="text-sm">Positive (4+ stars)</span>
                  </div>
                  <span className="font-semibold">{summary.positive_products}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <span className="text-sm">Neutral (3-3.9 stars)</span>
                  </div>
                  <span className="font-semibold">{summary.neutral_products}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-sm">Negative (&lt;3 stars)</span>
                  </div>
                  <span className="font-semibold">{summary.negative_products}</span>
                </div>
                <div className="pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Total Reviews: <span className="font-semibold text-foreground">{summary.total_reviews}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SKU List */}
      <Card>
        <CardHeader>
          <CardTitle>Product Performance Details</CardTitle>
          <CardDescription>
            Detailed breakdown of each SKU's performance across retailers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading SKU data...</div>
            </div>
          ) : skuData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Star className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground">
                No product reviews found for the selected time period
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {skuData.map((sku) => (
                <div
                  key={sku.product_id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  {/* Product Image */}
                  <div className="flex-shrink-0">
                    {sku.product_image_url ? (
                      <img
                        src={sku.product_image_url}
                        alt={sku.product_name}
                        className="h-16 w-16 object-cover rounded-md"
                      />
                    ) : (
                      <div className="h-16 w-16 bg-muted rounded-md flex items-center justify-center">
                        <Star className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-base">{sku.product_name}</h4>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {sku.retailers_count} retailers
                          </span>
                          <span>•</span>
                          <span>{sku.total_reviews} reviews</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(sku.trend)}
                        <Badge variant="outline" className={getSentimentColor(sku.sentiment)}>
                          {sku.sentiment}
                        </Badge>
                      </div>
                    </div>

                    {/* Rating & Stats */}
                    <div className="mt-3 flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < Math.round(sku.avg_rating)
                                  ? "text-yellow-500 fill-yellow-500"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="font-semibold">{sku.avg_rating.toFixed(1)}</span>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-green-600">
                          👍 {sku.positive_reviews} positive
                        </span>
                        <span className="text-red-600">
                          👎 {sku.negative_reviews} negative
                        </span>
                      </div>

                      {sku.recent_issues_count > 0 && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {sku.recent_issues_count} issues
                        </Badge>
                      )}
                    </div>

                    {/* Alerts */}
                    {sku.has_alerts && (
                      <div className="mt-3 space-y-1">
                        {sku.active_alerts.map((alert, idx) => (
                          <div
                            key={idx}
                            className="text-sm bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2"
                          >
                            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <span className="text-red-800">{alert.message}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Top Retailers with Complaints */}
                    {sku.top_complaint_retailers.length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        <span className="font-medium">Retailers with issues: </span>
                        {sku.top_complaint_retailers.slice(0, 3).map((r, idx) => (
                          <span key={r.retailer_id}>
                            {idx > 0 && ", "}
                            Retailer ({r.issue_count} issues)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
