import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import FeedbackRating from "./FeedbackRating";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DeliveryFeedbackModalProps {
  open: boolean;
  orderId: string;
  orderTotal: number;
  onClose: () => void;
  onComplete: () => void;
}

export const DeliveryFeedbackModal = ({
  open,
  orderId,
  orderTotal,
  onClose,
  onComplete,
}: DeliveryFeedbackModalProps) => {
  const { toast } = useToast();
  const [productRating, setProductRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [productFeedback, setProductFeedback] = useState("");
  const [deliveryFeedback, setDeliveryFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // At least one rating is required
    if (productRating === 0 && deliveryRating === 0) {
      toast({
        title: "Rating required",
        description: "Please provide at least one rating (product quality or delivery service)",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      const { data, error } = await supabase.functions.invoke("submit-delivery-feedback", {
        body: {
          orderId,
          productQualityRating: productRating || undefined,
          deliveryServiceRating: deliveryRating || undefined,
          productFeedback: productFeedback.trim() || undefined,
          deliveryFeedback: deliveryFeedback.trim() || undefined,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Thank you!",
          description: "Your feedback has been submitted successfully.",
        });
        onComplete();
      } else {
        throw new Error(data?.error || "Failed to submit feedback");
      }
    } catch (error: any) {
      console.error("Error submitting delivery feedback:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setProductRating(0);
      setDeliveryRating(0);
      setProductFeedback("");
      setDeliveryFeedback("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Delivery Feedback Required</DialogTitle>
          <DialogDescription>
            Please share your experience with your recent order (Order #{orderId.slice(0, 8)})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Product Quality Section */}
          <div className="space-y-3 p-4 border rounded-lg">
            <Label className="text-base font-semibold">Product Quality</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FeedbackRating
                  rating={productRating}
                  interactive
                  size="lg"
                  onChange={setProductRating}
                />
                {productRating > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {productRating} {productRating === 1 ? "star" : "stars"}
                  </span>
                )}
              </div>
              <Textarea
                placeholder="Tell us about the product quality (optional)"
                value={productFeedback}
                onChange={(e) => setProductFeedback(e.target.value)}
                rows={3}
                maxLength={1000}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {productFeedback.length}/1000 characters
              </p>
            </div>
          </div>

          {/* Delivery Service Section */}
          <div className="space-y-3 p-4 border rounded-lg">
            <Label className="text-base font-semibold">Delivery Service</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FeedbackRating
                  rating={deliveryRating}
                  interactive
                  size="lg"
                  onChange={setDeliveryRating}
                />
                {deliveryRating > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {deliveryRating} {deliveryRating === 1 ? "star" : "stars"}
                  </span>
                )}
              </div>
              <Textarea
                placeholder="Tell us about the delivery experience (optional)"
                value={deliveryFeedback}
                onChange={(e) => setDeliveryFeedback(e.target.value)}
                rows={3}
                maxLength={1000}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {deliveryFeedback.length}/1000 characters
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="flex-1"
            >
              Skip for Now
            </Button>
            <Button
              type="submit"
              disabled={submitting || (productRating === 0 && deliveryRating === 0)}
              className="flex-1"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Feedback"
              )}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            At least one rating is required. You can provide feedback later from your orders page.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DeliveryFeedbackModal;

