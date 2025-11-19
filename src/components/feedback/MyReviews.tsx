import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import FeedbackRating from "./FeedbackRating";
import { MessageSquare, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface MyReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  editedAt: string | null;
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
}

const MyReviews = () => {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyReviews();
  }, []);

  const fetchMyReviews = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("reviews")
        .select(`
          id,
          rating,
          comment,
          created_at,
          edited_at,
          product:products!inner(
            id,
            name,
            image_url
          )
        `)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedReviews = data?.map((review: any) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.created_at,
        editedAt: review.edited_at,
        product: {
          id: review.product.id,
          name: review.product.name,
          imageUrl: review.product.image_url,
        },
      })) || [];

      setReviews(formattedReviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
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
      <Card>
        <CardHeader>
          <CardTitle>My Reviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Reviews</CardTitle>
        <p className="text-sm text-muted-foreground">
          {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
        </p>
      </CardHeader>
      <CardContent>
        {reviews.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              You haven't written any reviews yet
            </p>
            <Button onClick={() => navigate("/orders")}>
              View Orders
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review, index) => (
              <div key={review.id}>
                {index > 0 && <Separator className="my-4" />}
                <div className="flex gap-4">
                  {review.product.imageUrl && (
                    <img
                      src={review.product.imageUrl}
                      alt={review.product.name}
                      className="w-16 h-16 rounded object-cover"
                    />
                  )}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{review.product.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <FeedbackRating rating={review.rating} size="sm" />
                          <span className="text-xs text-muted-foreground">
                            {formatDate(review.createdAt)}
                          </span>
                          {review.editedAt && (
                            <Badge variant="outline" className="text-xs">
                              Edited
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/product/${review.product.id}`)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {review.comment}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MyReviews;
