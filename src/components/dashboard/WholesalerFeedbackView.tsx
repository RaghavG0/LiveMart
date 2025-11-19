import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import FeedbackRating from "@/components/feedback/FeedbackRating";
import { Package, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProductPerformance {
  productId: string;
  productName: string;
  productImage: string | null;
  averageRating: number;
  totalReviews: number;
  retailersCount: number;
  sentiment: "positive" | "neutral" | "negative";
}

interface WholesalerFeedbackViewProps {
  wholesalerId: string;
}

const WholesalerFeedbackView = ({ wholesalerId }: WholesalerFeedbackViewProps) => {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductPerformance[]>([]);
  const [summary, setSummary] = useState({
    totalProducts: 0,
    averageRating: 0,
    totalReviews: 0,
    topRatedCount: 0,
  });

  useEffect(() => {
    fetchFeedbackData();
  }, [wholesalerId]);

  const fetchFeedbackData = async () => {
    try {
      setLoading(false);

      // Fetch all products supplied by this wholesaler
      const { data: wholesalerProducts, error: productsError } = await supabase
        .from("products")
        .select("id, name, image_url")
        .eq("seller_id", wholesalerId)
        .eq("is_available", true);

      if (productsError) throw productsError;

      if (!wholesalerProducts || wholesalerProducts.length === 0) {
        setLoading(false);
        return;
      }

      // For each product, find retailers who purchased it and reviews
      const productPerformance: ProductPerformance[] = await Promise.all(
        wholesalerProducts.map(async (product) => {
          // Find retailer orders for this product
          const { data: retailerOrders } = await supabase
            .from("order_items")
            .select(`
              order_id,
              orders!inner(
                customer_id,
                order_type,
                status
              )
            `)
            .eq("product_id", product.id)
            .eq("orders.order_type", "retailer")
            .eq("orders.status", "delivered");

          const uniqueRetailers = new Set(
            retailerOrders?.map((item: any) => item.orders.customer_id) || []
          );

          // Now find products created by these retailers based on this wholesaler product
          // In a real scenario, you'd track which retailer products came from which wholesaler products
          // For now, we'll check reviews on products with the same name sold by these retailers
          const { data: reviews } = await supabase
            .from("reviews")
            .select(`
              id,
              rating,
              product:products!inner(
                seller_id,
                name
              )
            `)
            .eq("product.name", product.name)
            .in("product.seller_id", Array.from(uniqueRetailers));

          const totalReviews = reviews?.length || 0;
          const averageRating = totalReviews > 0
            ? reviews!.reduce((sum, r) => sum + r.rating, 0) / totalReviews
            : 0;

          let sentiment: "positive" | "neutral" | "negative" = "neutral";
          if (averageRating >= 4) sentiment = "positive";
          else if (averageRating < 3) sentiment = "negative";

          return {
            productId: product.id,
            productName: product.name,
            productImage: product.image_url,
            averageRating: Math.round(averageRating * 10) / 10,
            totalReviews,
            retailersCount: uniqueRetailers.size,
            sentiment,
          };
        })
      );

      // Calculate summary
      const productsWithReviews = productPerformance.filter((p) => p.totalReviews > 0);
      const totalReviews = productsWithReviews.reduce((sum, p) => sum + p.totalReviews, 0);
      const totalRatingSum = productsWithReviews.reduce(
        (sum, p) => sum + p.averageRating * p.totalReviews,
        0
      );
      const overallAverage = totalReviews > 0 ? totalRatingSum / totalReviews : 0;
      const topRated = productsWithReviews.filter((p) => p.averageRating >= 4).length;

      setSummary({
        totalProducts: productsWithReviews.length,
        averageRating: Math.round(overallAverage * 10) / 10,
        totalReviews,
        topRatedCount: topRated,
      });

      setProducts(productPerformance.sort((a, b) => b.totalReviews - a.totalReviews));
    } catch (error) {
      console.error("Error fetching wholesaler feedback data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "negative":
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <TrendingUp className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">Excellent</Badge>;
      case "negative":
        return <Badge variant="destructive">Needs Attention</Badge>;
      default:
        return <Badge variant="secondary">Average</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Products Reviewed</p>
                <p className="text-2xl font-bold mt-1">{summary.totalProducts}</p>
              </div>
              <Package className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Average Rating</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-2xl font-bold">{summary.averageRating.toFixed(1)}</p>
                  <FeedbackRating rating={summary.averageRating} size="sm" />
                </div>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Reviews</p>
                <p className="text-2xl font-bold mt-1">{summary.totalReviews}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Top Rated</p>
                <p className="text-2xl font-bold mt-1">{summary.topRatedCount}</p>
                <p className="text-xs text-muted-foreground">4+ stars</p>
              </div>
              <CheckCircle className="h-8 w-8 text-yellow-600 fill-yellow-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Product Performance</CardTitle>
          <CardDescription>
            Customer feedback on products supplied to retailers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {products.filter((p) => p.totalReviews > 0).length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">
                No customer feedback yet on your supplied products
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Reviews will appear here once retailers sell your products to customers
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {products
                .filter((p) => p.totalReviews > 0)
                .map((product, index) => (
                  <div key={product.productId}>
                    {index > 0 && <Separator className="my-4" />}
                    <div className="flex items-start gap-4">
                      {product.productImage && (
                        <img
                          src={product.productImage}
                          alt={product.productName}
                          className="w-16 h-16 rounded object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold">{product.productName}</h4>
                            <p className="text-sm text-muted-foreground">
                              Supplied to {product.retailersCount}{" "}
                              {product.retailersCount === 1 ? "retailer" : "retailers"}
                            </p>
                          </div>
                          {getSentimentBadge(product.sentiment)}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <FeedbackRating rating={product.averageRating} size="sm" showValue />
                          </div>
                          <Separator orientation="vertical" className="h-4" />
                          <span className="text-sm text-muted-foreground">
                            {product.totalReviews} customer{" "}
                            {product.totalReviews === 1 ? "review" : "reviews"}
                          </span>
                          <Separator orientation="vertical" className="h-4" />
                          <div className="flex items-center gap-1">
                            {getSentimentIcon(product.sentiment)}
                            <span className="text-sm text-muted-foreground capitalize">
                              {product.sentiment}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WholesalerFeedbackView;
