import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import FeedbackRating from "./FeedbackRating";
import { ImageUploadComponent } from "@/components/uploads/ImageUploadComponent";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FeedbackFormProps {
  productId: string;
  productName: string;
  orderId?: string; // Optional for open review policy
  existingReview?: {
    rating: number;
    comment: string | null;
  };
  onSuccess?: () => void;
  className?: string;
}

const FeedbackForm = ({
  productId,
  productName,
  orderId,
  existingReview,
  onSuccess,
  className,
}: FeedbackFormProps) => {
  const { toast } = useToast();
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [comment, setComment] = useState(existingReview?.comment || "");
  const [uploadedImageIds, setUploadedImageIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating);
      setComment(existingReview.comment || "");
    }
  }, [existingReview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast({
        title: "Rating required",
        description: "Please select a star rating",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      setSubmitSuccess(false);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please sign in to submit a review",
          variant: "destructive",
        });
        return;
      }

      // Use new submit-review endpoint for open review policy
      const { data, error } = await supabase.functions.invoke("submit-review", {
        body: {
          productId,
          orderId: orderId || undefined, // Optional
          rating,
          comment: comment.trim() || undefined,
          imageIds: uploadedImageIds.length > 0 ? uploadedImageIds : undefined,
        },
      });

      if (error) throw error;

      if (data?.success) {
        // Mark images as referenced
        if (uploadedImageIds.length > 0 && data.reviewId) {
          for (const imageId of uploadedImageIds) {
            await supabase.rpc('mark_image_referenced', {
              p_image_id: imageId,
              p_table_name: 'reviews',
              p_record_id: data.reviewId
            });
          }
        }

        setSubmitSuccess(true);
        toast({
          title: "Success!",
          description: data.message,
        });
        
        // Call onSuccess callback after a brief delay
        setTimeout(() => {
          onSuccess?.();
        }, 1500);
      }
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit review. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-300">
              Thank you for your feedback! Your review has been {existingReview ? "updated" : "submitted"} successfully.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSubmitSuccess(false);
                setRating(0);
                setComment("");
                setUploadedImageIds([]);
                onSuccess?.();
              }}
            >
              Write Another Review
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>
          {existingReview ? "Edit Your Review" : "Write a Review"}
        </CardTitle>
        <CardDescription>
          Share your experience with {productName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Your Rating *</Label>
            <div className="flex items-center gap-2">
              <FeedbackRating
                rating={rating}
                interactive
                size="lg"
                onChange={setRating}
              />
              {rating > 0 && (
                <span className="text-sm text-muted-foreground ml-2">
                  {rating} {rating === 1 ? "star" : "stars"}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Your Review (Optional)</Label>
            <Textarea
              id="comment"
              placeholder="Tell others about your experience with this product..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={1000}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/1000 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label>Photos (Optional)</Label>
            <ImageUploadComponent
              uploadType="feedback_image"
              maxFiles={3}
              maxSizeMB={5}
              onUploadComplete={(uploadIds) => {
                setUploadedImageIds(prev => [...prev, ...uploadIds]);
                toast({
                  title: "Images uploaded",
                  description: `${uploadIds.length} image(s) uploaded successfully`,
                });
              }}
            />
          </div>

          {rating === 0 && (
            <Alert variant="default">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please select a star rating to submit your review
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={submitting || rating === 0}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {existingReview ? "Updating..." : "Submitting..."}
              </>
            ) : (
              <>{existingReview ? "Update Review" : "Submit Review"}</>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default FeedbackForm;
