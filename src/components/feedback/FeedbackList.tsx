import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import FeedbackRating from "./FeedbackRating";
import ReviewReplies from "./ReviewReplies";
import { ChevronLeft, ChevronRight, MessageSquare, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  customerName: string;
  createdAt: string;
  editedAt: string | null;
  isEdited: boolean;
  verified_buyer?: boolean;
  product_seller_id?: string;
}

interface FeedbackSummary {
  averageRating: number;
  totalReviews: number;
}

interface FeedbackListProps {
  productId: string;
  className?: string;
  refreshTrigger?: number; // Add refresh trigger prop
}

const FeedbackList = ({ productId, className, refreshTrigger }: FeedbackListProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<FeedbackSummary>({
    averageRating: 0,
    totalReviews: 0,
  });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [productSellerId, setProductSellerId] = useState<string | null>(null);
  const itemsPerPage = 5;

  useEffect(() => {
    // Get current user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id || null);
    });

    // Get product seller ID
    supabase
      .from("products")
      .select("seller_id")
      .eq("id", productId)
      .single()
      .then(({ data }) => {
        setProductSellerId(data?.seller_id || null);
      });
  }, [productId]);

  useEffect(() => {
    fetchFeedback();
  }, [productId, currentPage, refreshTrigger]); // Add refreshTrigger to dependencies

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke(
        "get-product-feedback",
        {
          body: {
            productId,
            page: currentPage,
            limit: itemsPerPage,
          },
        }
      );

      if (error) throw error;

      if (data?.success) {
        setReviews(data.data.reviews);
        setSummary(data.data.summary);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Error fetching feedback:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-2xl mb-2">Customer Reviews</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <FeedbackRating
                  rating={summary.averageRating}
                  size="lg"
                  showValue
                />
              </div>
              <Separator orientation="vertical" className="h-6" />
              <p className="text-muted-foreground">
                {summary.totalReviews} {summary.totalReviews === 1 ? "review" : "reviews"}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {reviews.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">
              No reviews yet. Be the first to review this product!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {reviews.map((review, index) => (
              <div key={review.id}>
                {index > 0 && <Separator className="mb-6" />}
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{review.customerName}</p>
                        {review.verified_buyer && (
                          <Badge variant="default" className="text-xs bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Verified Buyer
                          </Badge>
                        )}
                      </div>
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
                    <p className="text-foreground leading-relaxed mt-2">
                      {review.comment}
                    </p>
                  )}
                  
                  {/* Threaded Replies Section */}
                  <div className="mt-4 pt-4 border-t">
                    <ReviewReplies
                      reviewId={review.id}
                      productSellerId={productSellerId || undefined}
                      currentUserId={currentUserId || undefined}
                    />
                  </div>
                </div>
              </div>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FeedbackList;
