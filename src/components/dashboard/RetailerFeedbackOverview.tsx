import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import FeedbackRating from "@/components/feedback/FeedbackRating";
import { ChevronDown, ChevronUp, MessageSquare, Star, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProductFeedback {
  productId: string;
  productName: string;
  productImage: string | null;
  averageRating: number;
  totalReviews: number;
  recentReviews: Review[];
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  customerName: string;
  createdAt: string;
  isEdited: boolean;
}

interface RetailerFeedbackOverviewProps {
  retailerId: string;
}

const RetailerFeedbackOverview = ({ retailerId }: RetailerFeedbackOverviewProps) => {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductFeedback[]>([]);
  const [summary, setSummary] = useState({
    totalReviews: 0,
    averageRating: 0,
    ratingDistribution: {} as Record<string, number>,
  });
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"rating" | "reviews">("reviews");

  useEffect(() => {
    fetchFeedbackData();
  }, [retailerId]);

  const fetchFeedbackData = async () => {
    try {
      setLoading(true);

      // Fetch retailer's products with reviews
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select(`
          id,
          name,
          image_url,
          reviews (
            id,
            rating,
            comment,
            created_at,
            edited_at,
            profiles!inner(full_name)
          )
        `)
        .eq("seller_id", retailerId)
        .eq("is_available", true);

      if (productsError) throw productsError;

      // Process products data
      const processedProducts: ProductFeedback[] = (productsData || [])
        .map((product: any) => {
          const reviews = product.reviews || [];
          const totalReviews = reviews.length;
          const averageRating = totalReviews > 0
            ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / totalReviews
            : 0;

          return {
            productId: product.id,
            productName: product.name,
            productImage: product.image_url,
            averageRating: Math.round(averageRating * 10) / 10,
            totalReviews,
            recentReviews: reviews
              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 5)
              .map((review: any) => ({
                id: review.id,
                rating: review.rating,
                comment: review.comment,
                customerName: review.profiles?.full_name || "Anonymous",
                createdAt: review.created_at,
                isEdited: !!review.edited_at,
              })),
          };
        })
        .filter((p: ProductFeedback) => p.totalReviews > 0);

      // Calculate summary
      const allReviews = processedProducts.reduce((sum, p) => sum + p.totalReviews, 0);
      const totalRatingSum = processedProducts.reduce(
        (sum, p) => sum + p.averageRating * p.totalReviews,
        0
      );
      const overallAverage = allReviews > 0 ? totalRatingSum / allReviews : 0;

      // Calculate rating distribution
      const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
      productsData?.forEach((product: any) => {
        product.reviews?.forEach((review: any) => {
          distribution[review.rating.toString()] = (distribution[review.rating.toString()] || 0) + 1;
        });
      });

      setSummary({
        totalReviews: allReviews,
        averageRating: Math.round(overallAverage * 10) / 10,
        ratingDistribution: distribution,
      });

      setProducts(processedProducts);
    } catch (error) {
      console.error("Error fetching feedback data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleProduct = (productId: string) => {
    setExpandedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === "rating") {
      return b.averageRating - a.averageRating;
    }
    return b.totalReviews - a.totalReviews;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Star className="h-8 w-8 text-yellow-400 fill-yellow-400" />
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
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Products Reviewed</p>
                <p className="text-2xl font-bold mt-1">{products.length}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Feedback */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Product Reviews</CardTitle>
              <CardDescription>Customer feedback on your products</CardDescription>
            </div>
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reviews">Most Reviews</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">No reviews yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedProducts.map((product) => (
                <Collapsible
                  key={product.productId}
                  open={expandedProducts.has(product.productId)}
                  onOpenChange={() => toggleProduct(product.productId)}
                >
                  <div className="border rounded-lg">
                    <CollapsibleTrigger className="w-full p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        {product.productImage && (
                          <img
                            src={product.productImage}
                            alt={product.productName}
                            className="w-12 h-12 rounded object-cover"
                          />
                        )}
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold">{product.productName}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <FeedbackRating rating={product.averageRating} size="sm" showValue />
                            <Separator orientation="vertical" className="h-4" />
                            <span className="text-sm text-muted-foreground">
                              {product.totalReviews} {product.totalReviews === 1 ? "review" : "reviews"}
                            </span>
                          </div>
                        </div>
                        {expandedProducts.has(product.productId) ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <Separator />
                      <div className="p-4 space-y-4">
                        {product.recentReviews.map((review, index) => (
                          <div key={review.id}>
                            {index > 0 && <Separator className="my-4" />}
                            <div className="space-y-2">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium text-sm">{review.customerName}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <FeedbackRating rating={review.rating} size="sm" />
                                    <span className="text-xs text-muted-foreground">
                                      {formatDate(review.createdAt)}
                                    </span>
                                    {review.isEdited && (
                                      <Badge variant="outline" className="text-xs">
                                        Edited
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {review.comment && (
                                <p className="text-sm text-foreground">{review.comment}</p>
                              )}
                            </div>
                          </div>
                        ))}
                        {product.totalReviews > 5 && (
                          <Button variant="outline" size="sm" className="w-full mt-4">
                            View All {product.totalReviews} Reviews
                          </Button>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RetailerFeedbackOverview;
