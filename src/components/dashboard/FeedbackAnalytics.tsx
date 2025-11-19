import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Star, MessageSquare, ThumbsUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface FeedbackAnalyticsProps {
  retailerId: string;
  productId?: string; // Optional: for single product view
}

interface AnalyticsData {
  avgRating: number;
  totalReviews: number;
  positivePercentage: number;
  recentReviews: number;
  trend: "up" | "down" | "stable";
  ratingDistribution: { rating: number; count: number }[];
  timeSeriesData: { date: string; rating: number; count: number }[];
}

const FeedbackAnalytics = ({ retailerId, productId }: FeedbackAnalyticsProps) => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<"7" | "30" | "90" | "365">("30");

  useEffect(() => {
    fetchAnalytics();
  }, [retailerId, productId, timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      const daysAgo = parseInt(timeRange);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

      // Build query
      let query = supabase
        .from("reviews")
        .select(`
          id,
          rating,
          created_at,
          products!inner(
            id,
            seller_id
          )
        `)
        .eq("products.seller_id", retailerId)
        .gte("created_at", cutoffDate.toISOString());

      if (productId) {
        query = query.eq("product_id", productId);
      }

      const { data: reviews, error } = await query;

      if (error) throw error;

      if (!reviews || reviews.length === 0) {
        setAnalytics({
          avgRating: 0,
          totalReviews: 0,
          positivePercentage: 0,
          recentReviews: 0,
          trend: "stable",
          ratingDistribution: [],
          timeSeriesData: [],
        });
        return;
      }

      // Calculate metrics
      const totalReviews = reviews.length;
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
      const positiveCount = reviews.filter((r) => r.rating >= 4).length;
      const positivePercentage = (positiveCount / totalReviews) * 100;

      // Recent reviews (last 7 days)
      const last7Days = new Date();
      last7Days.setDate(last7Days.getDate() - 7);
      const recentReviews = reviews.filter(
        (r) => new Date(r.created_at) >= last7Days
      ).length;

      // Rating distribution
      const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      reviews.forEach((r) => {
        ratingCounts[r.rating] = (ratingCounts[r.rating] || 0) + 1;
      });
      const ratingDistribution = Object.entries(ratingCounts).map(([rating, count]) => ({
        rating: parseInt(rating),
        count,
      }));

      // Time series data (grouped by week for 30+ days, by day for < 30 days)
      const groupByDay = daysAgo <= 30;
      const timeSeriesMap: Record<string, { sum: number; count: number }> = {};

      reviews.forEach((r) => {
        const date = new Date(r.created_at);
        let key: string;
        
        if (groupByDay) {
          key = date.toISOString().split("T")[0]; // YYYY-MM-DD
        } else {
          // Group by week
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split("T")[0];
        }

        if (!timeSeriesMap[key]) {
          timeSeriesMap[key] = { sum: 0, count: 0 };
        }
        timeSeriesMap[key].sum += r.rating;
        timeSeriesMap[key].count += 1;
      });

      const timeSeriesData = Object.entries(timeSeriesMap)
        .map(([date, { sum, count }]) => ({
          date,
          rating: parseFloat((sum / count).toFixed(2)),
          count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate trend
      let trend: "up" | "down" | "stable" = "stable";
      if (timeSeriesData.length >= 2) {
        const firstHalf = timeSeriesData.slice(0, Math.floor(timeSeriesData.length / 2));
        const secondHalf = timeSeriesData.slice(Math.floor(timeSeriesData.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, d) => sum + d.rating, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, d) => sum + d.rating, 0) / secondHalf.length;
        
        if (secondAvg > firstAvg + 0.2) trend = "up";
        else if (secondAvg < firstAvg - 0.2) trend = "down";
      }

      setAnalytics({
        avgRating: parseFloat(avgRating.toFixed(2)),
        totalReviews,
        positivePercentage: parseFloat(positivePercentage.toFixed(1)),
        recentReviews,
        trend,
        ratingDistribution,
        timeSeriesData,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header with Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Feedback Analytics</h3>
          <p className="text-sm text-muted-foreground">
            Track your rating trends and customer satisfaction
          </p>
        </div>
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Rating</p>
                <p className="text-2xl font-bold flex items-center gap-1">
                  {analytics.avgRating.toFixed(1)}
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                </p>
              </div>
              {analytics.trend !== "stable" && (
                <Badge variant={analytics.trend === "up" ? "default" : "destructive"}>
                  {analytics.trend === "up" ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {analytics.trend === "up" ? "Improving" : "Declining"}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Reviews</p>
            <p className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              {analytics.totalReviews}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Reviews (7d)</p>
            <p className="text-2xl font-bold text-blue-600">
              +{analytics.recentReviews}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Positive (4-5★)</p>
            <p className="text-2xl font-bold flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-green-600" />
              {analytics.positivePercentage}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Rating Trend Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rating Trend</CardTitle>
            <CardDescription>Average rating over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={analytics.timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  fontSize={12}
                />
                <YAxis domain={[0, 5]} fontSize={12} />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value: number) => [value.toFixed(2), "Avg Rating"]}
                />
                <Line
                  type="monotone"
                  dataKey="rating"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Rating Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rating Distribution</CardTitle>
            <CardDescription>Breakdown by star rating</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.ratingDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="rating"
                  tickFormatter={(value) => `${value}★`}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(value: number) => [value, "Reviews"]}
                  labelFormatter={(value) => `${value} Star${value > 1 ? "s" : ""}`}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FeedbackAnalytics;
