import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Send, Edit, Trash2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import FeedbackRating from "@/components/feedback/FeedbackRating";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

interface ProductReviewsModalProps {
  productId: string;
  productName: string;
  reviews: Review[];
  onClose: () => void;
  onReplyAdded: () => void;
}

const ProductReviewsModal = ({
  productId,
  productName,
  reviews,
  onClose,
  onReplyAdded,
}: ProductReviewsModalProps) => {
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [editingReply, setEditingReply] = useState<{ [key: string]: boolean }>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [deletingReply, setDeletingReply] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);

  const handleReplySubmit = async (reviewId: string) => {
    const text = replyText[reviewId]?.trim();
    
    if (!text || text.length < 10) {
      toast.error("Reply must be at least 10 characters long");
      return;
    }

    if (text.length > 2000) {
      toast.error("Reply must not exceed 2000 characters");
      return;
    }

    try {
      setSubmitting(reviewId);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to reply");
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        `reply-to-feedback/${reviewId}`,
        {
          method: editingReply[reviewId] ? "PUT" : "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ reply: text }),
        }
      );

      if (error) throw error;

      if (data.success) {
        toast.success(editingReply[reviewId] ? "Reply updated successfully" : "Reply submitted successfully");
        setReplyText(prev => ({ ...prev, [reviewId]: "" }));
        setEditingReply(prev => ({ ...prev, [reviewId]: false }));
        onReplyAdded();
      } else {
        toast.error(data.message || "Failed to submit reply");
      }
    } catch (error) {
      console.error("Error submitting reply:", error);
      toast.error("Failed to submit reply. Please try again.");
    } finally {
      setSubmitting(null);
    }
  };

  const handleDeleteReply = async (reviewId: string) => {
    try {
      setDeletingReply(reviewId);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to delete reply");
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        `reply-to-feedback/${reviewId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) throw error;

      if (data.success) {
        toast.success("Reply deleted successfully");
        onReplyAdded();
      } else {
        toast.error(data.message || "Failed to delete reply");
      }
    } catch (error) {
      console.error("Error deleting reply:", error);
      toast.error("Failed to delete reply. Please try again.");
    } finally {
      setDeletingReply(null);
      setShowDeleteDialog(null);
    }
  };

  const startEditReply = (reviewId: string, currentReply: string) => {
    setReplyText(prev => ({ ...prev, [reviewId]: currentReply }));
    setEditingReply(prev => ({ ...prev, [reviewId]: true }));
  };

  const cancelEdit = (reviewId: string) => {
    setReplyText(prev => ({ ...prev, [reviewId]: "" }));
    setEditingReply(prev => ({ ...prev, [reviewId]: false }));
  };

  const canEditReply = (reply: Review["reply"]): boolean => {
    if (!reply) return false;
    const createdAt = new Date(reply.createdAt);
    const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceCreation <= 24;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{productName}</h3>
          <p className="text-sm text-muted-foreground">{reviews.length} reviews</p>
        </div>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>

      <Separator />

      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
        {reviews.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No reviews yet
            </CardContent>
          </Card>
        ) : (
          reviews.map((review) => (
            <Card key={review.id} className="border-l-4 border-l-primary/20">
              <CardContent className="pt-6 space-y-4">
                {/* Customer Review */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-xs">
                          {review.customerName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{review.customerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                          {review.isEdited && " (edited)"}
                        </p>
                      </div>
                    </div>
                    <FeedbackRating rating={review.rating} size="sm" />
                  </div>
                  
                  {review.comment && (
                    <p className="text-sm mt-2 pl-10 whitespace-pre-wrap break-words">{review.comment}</p>
                  )}
                </div>

                {/* Seller Reply */}
                {review.reply && !editingReply[review.id] ? (
                  <div className="ml-10 pl-4 border-l-2 border-primary/30 bg-muted/50 p-3 rounded-r space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge variant="secondary" className="text-xs mb-1">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Your Reply
                        </Badge>
                        <p className="text-sm mt-1">{review.reply.replyText}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(review.reply.createdAt), { addSuffix: true })}
                          {review.reply.editedAt && " (edited)"}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {canEditReply(review.reply) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditReply(review.id, review.reply!.replyText)}
                            disabled={!!submitting || !!deletingReply}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDeleteDialog(review.id)}
                          disabled={!!submitting || !!deletingReply}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="ml-10 space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      {editingReply[review.id] ? "Edit Reply" : "Reply to Customer"}
                    </label>
                    <Textarea
                      placeholder="Write your response to this review..."
                      value={replyText[review.id] || ""}
                      onChange={(e) => setReplyText(prev => ({ ...prev, [review.id]: e.target.value }))}
                      className="min-h-[100px]"
                      disabled={submitting === review.id}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {replyText[review.id]?.length || 0} / 2000 characters
                        {replyText[review.id] && replyText[review.id].length < 10 && (
                          <span className="text-orange-500 ml-2">
                            (minimum 10 characters)
                          </span>
                        )}
                      </p>
                      <div className="flex gap-2">
                        {editingReply[review.id] && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelEdit(review.id)}
                            disabled={submitting === review.id}
                          >
                            Cancel
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleReplySubmit(review.id)}
                          disabled={
                            !replyText[review.id] ||
                            replyText[review.id].length < 10 ||
                            submitting === review.id
                          }
                        >
                          {submitting === review.id ? (
                            <>Submitting...</>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              {editingReply[review.id] ? "Update Reply" : "Send Reply"}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <Separator className="mt-4" />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reply?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this reply? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingReply}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteDialog && handleDeleteReply(showDeleteDialog)}
              disabled={!!deletingReply}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingReply ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProductReviewsModal;
