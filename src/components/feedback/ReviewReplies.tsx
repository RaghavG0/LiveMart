import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Reply, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface Reply {
  id: string;
  reply_text: string;
  reply_type: "vendor" | "user";
  created_at: string;
  edited_at: string | null;
  parent_reply_id: string | null;
  seller_id: string | null;
  user_id: string | null;
  profiles?: {
    full_name: string;
    avatar_url: string | null;
  };
  products?: {
    seller_id: string;
  };
}

interface ReviewRepliesProps {
  reviewId: string;
  productSellerId?: string;
  currentUserId?: string;
}

export const ReviewReplies = ({ reviewId, productSellerId, currentUserId }: ReviewRepliesProps) => {
  const { toast } = useToast();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReplies();
  }, [reviewId]);

  const fetchReplies = async () => {
    try {
      setLoading(true);
      // Fetch replies with both user and seller profiles
      const { data, error } = await supabase
        .from("review_replies")
        .select(`
          *,
          user_profiles:user_id (
            full_name,
            avatar_url
          ),
          seller_profiles:seller_id (
            full_name,
            avatar_url
          )
        `)
        .eq("review_id", reviewId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      // Map replies to include the correct profile
      const mappedReplies = (data || []).map((reply: any) => ({
        ...reply,
        profiles: reply.reply_type === 'vendor' 
          ? reply.seller_profiles 
          : reply.user_profiles,
      }));
      
      setReplies(mappedReplies);
    } catch (error: any) {
      console.error("Error fetching replies:", error);
      toast({
        title: "Error",
        description: "Failed to load replies",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReply = async (parentReplyId: string | null = null) => {
    if (!replyText.trim() || replyText.trim().length < 10) {
      toast({
        title: "Invalid reply",
        description: "Reply must be at least 10 characters",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      // Determine reply type
      const isVendor = productSellerId === currentUserId;
      const replyType = isVendor ? "vendor" : "user";

      const { data, error } = await supabase.functions.invoke("submit-reply", {
        body: {
          reviewId,
          parentReplyId,
          replyText: replyText.trim(),
          replyType,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Success",
          description: "Your reply has been posted",
        });
        setReplyText("");
        setReplyingTo(null);
        fetchReplies();
      } else {
        throw new Error(data?.error || "Failed to submit reply");
      }
    } catch (error: any) {
      console.error("Error submitting reply:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit reply",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Organize replies into threads
  const organizeReplies = (replies: Reply[]): Reply[] => {
    const replyMap = new Map<string, Reply>();
    const rootReplies: Reply[] = [];

    // First pass: create map
    replies.forEach((reply) => {
      replyMap.set(reply.id, reply);
    });

    // Second pass: organize into threads
    replies.forEach((reply) => {
      if (!reply.parent_reply_id) {
        rootReplies.push(reply);
      }
    });

    return rootReplies;
  };

  const renderReply = (reply: Reply, depth = 0) => {
    const childReplies = replies.filter((r) => r.parent_reply_id === reply.id);
    const isVendor = reply.reply_type === "vendor";
    const userName = reply.profiles?.full_name || "Anonymous";
    const initials = userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return (
      <div key={reply.id} className={`${depth > 0 ? "ml-8 mt-3 border-l-2 pl-4" : ""}`}>
        <Card className="mb-3">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-sm">{userName}</span>
                  {isVendor && (
                    <Badge variant="secondary" className="text-xs">
                      Vendor
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                  </span>
                  {reply.edited_at && (
                    <span className="text-xs text-muted-foreground">(edited)</span>
                  )}
                </div>
                <p className="text-sm text-foreground mb-3 whitespace-pre-wrap">{reply.reply_text}</p>
                {currentUserId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReplyingTo(reply.id)}
                    className="text-xs"
                  >
                    <Reply className="h-3 w-3 mr-1" />
                    Reply
                  </Button>
                )}
              </div>
            </div>

            {/* Reply form */}
            {replyingTo === reply.id && (
              <div className="mt-3 pt-3 border-t">
                <Textarea
                  placeholder="Write a reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  className="mb-2"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyText("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSubmitReply(reply.id)}
                    disabled={submitting || replyText.trim().length < 10}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      "Post Reply"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Child replies */}
            {childReplies.map((child) => renderReply(child, depth + 1))}
          </CardContent>
        </Card>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rootReplies = organizeReplies(replies);

  return (
    <div className="space-y-4">
      {/* Main reply form */}
      {currentUserId && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground mt-1" />
              <div className="flex-1">
                <Textarea
                  placeholder="Add a reply to this review..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  className="mb-2"
                  disabled={!!replyingTo}
                />
                <div className="flex gap-2 justify-end">
                  {replyingTo && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyText("");
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => handleSubmitReply(null)}
                    disabled={submitting || !!replyingTo || replyText.trim().length < 10}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      "Post Reply"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Replies list */}
      {rootReplies.length > 0 ? (
        <div className="space-y-2">
          {rootReplies.map((reply) => renderReply(reply))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          No replies yet. Be the first to reply!
        </p>
      )}
    </div>
  );
};

export default ReviewReplies;

