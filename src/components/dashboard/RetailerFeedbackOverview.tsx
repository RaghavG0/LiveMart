import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FeedbackRating from "@/components/feedback/FeedbackRating";
import ProductReviewsModal from "./ProductReviewsModal";
import FeedbackAnalytics from "./FeedbackAnalytics";
import { Eye, MessageSquare, Star, TrendingUp, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  allReviews: Review[];
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  customerName: string;
  createdAt: string;
  editedAt: string | null;
  isEdited: boolean;
  reply?: {
    id: string;
    replyText: string;
    createdAt: string;
    editedAt: string | null;
  };
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
  const [selectedProduct, setSelectedProduct] = useState<ProductFeedback | null>(null);
  const [sortBy, setSortBy] = useState<"rating" | "reviews">("reviews");

  useEffect(() => {
    fetchFeedbackData();
  }, [retailerId]);

  const fetchFeedbackData = async () => {
    try {
      setLoading(true);

      // Fetch retailer's products with reviews and replies
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
            profiles!inner(full_name),
            review_replies (
              id,
              reply_text,
              created_at,
              edited_at
            )
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
            allReviews: reviews
              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((review: any) => ({
                id: review.id,
                rating: review.rating,
                comment: review.comment,
                customerName: review.profiles?.full_name || "Anonymous",
                createdAt: review.created_at,
                editedAt: review.edited_at,
                isEdited: !!review.edited_at,
                reply: review.review_replies && review.review_replies.length > 0 ? {
                  id: review.review_replies[0].id,
                  replyText: review.review_replies[0].reply_text,
                  createdAt: review.review_replies[0].created_at,
                  editedAt: review.review_replies[0].edited_at,
                } : undefined,
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

  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === "rating") {
      return b.averageRating - a.averageRating;
    }
    return b.totalReviews - a.totalReviews;
  });

  const handleViewReviews = (product: ProductFeedback) => {
    setSelectedProduct(product);
  };

  const handleCloseModal = () => {
    setSelectedProduct(null);
  };

  const handleReplyAdded = () => {
    fetchFeedbackData(); // Refresh data
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
      {/* Analytics Section */}
      <FeedbackAnalytics retailerId={retailerId} />

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
              <Package className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Feedback Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Product Reviews</CardTitle>
              <CardDescription>Manage customer feedback and respond to reviews</CardDescription>
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
            <div className="text-center py-12">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">No reviews yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Customer reviews will appear here once you receive them
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedProducts.map((product) => (
                <div
                  key={product.productId}
                  className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {product.productImage && (
                        <img
                          src={product.productImage}
                          alt={product.productName}
                          className="w-16 h-16 rounded object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-base">{product.productName}</h4>
                        <div className="flex items-center gap-4 mt-2">
                          <FeedbackRating rating={product.averageRating} size="sm" showValue />
                          <Separator orientation="vertical" className="h-4" />
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MessageSquare className="h-4 w-4" />
                            <span>{product.totalReviews} reviews</span>
                          </div>
                          {product.allReviews.some(r => !r.reply) && (
                            <Badge variant="secondary">
                              {product.allReviews.filter(r => !r.reply).length} unanswered
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewReviews(product)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View & Reply
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviews Modal */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Product Reviews</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <ProductReviewsModal
              productId={selectedProduct.productId}
              productName={selectedProduct.productName}
              reviews={selectedProduct.allReviews}
              onClose={handleCloseModal}
              onReplyAdded={handleReplyAdded}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RetailerFeedbackOverview;
