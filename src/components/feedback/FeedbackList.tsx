import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import FeedbackRating from "./FeedbackRating";
import { ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  customerName: string;
  createdAt: string;
  editedAt: string | null;
  isEdited: boolean;
}

interface FeedbackSummary {
  averageRating: number;
  totalReviews: number;
}

interface FeedbackListProps {
  productId: string;
  className?: string;
}

const FeedbackList = ({ productId, className }: FeedbackListProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<FeedbackSummary>({
    averageRating: 0,
    totalReviews: 0,
  });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    fetchFeedback();
  }, [productId, currentPage]);

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
                      <p className="font-semibold">{review.customerName}</p>
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
