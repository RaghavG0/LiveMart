import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ModerationQueueItem,
  ModerationFilters,
  ModerationActionType,
  EscalationType,
} from "@/types/moderation";
import { ModerationFiltersComponent } from "./ModerationFilters";
import {
  CheckCircle,
  XCircle,
  Edit3,
  AlertTriangle,
  Star,
  Clock,
  Flag,
  User,
} from "lucide-react";

export function ModerationQueue() {
  const [queueItems, setQueueItems] = useState<ModerationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<ModerationFilters>({});
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [currentAction, setCurrentAction] = useState<{
    item: ModerationQueueItem;
    type: ModerationActionType;
  } | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionNotes, setActionNotes] = useState("");
  const [newRating, setNewRating] = useState<number>(0);
  const [newComment, setNewComment] = useState("");
  const [escalationType, setEscalationType] = useState<EscalationType>("legal");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Please sign in");
        return;
      }

      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append("status", filters.status);
      if (filters.productId) queryParams.append("productId", filters.productId);
      if (filters.minPriority !== undefined)
        queryParams.append("minPriority", filters.minPriority.toString());
      if (filters.dateFrom) queryParams.append("dateFrom", filters.dateFrom);
      if (filters.dateTo) queryParams.append("dateTo", filters.dateTo);
      if (filters.minRating) queryParams.append("minRating", filters.minRating.toString());
      if (filters.maxRating) queryParams.append("maxRating", filters.maxRating.toString());
      if (filters.flaggedOnly) queryParams.append("flaggedOnly", "true");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-moderation-queue?${queryParams}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch moderation queue");

      const result = await response.json();
      setQueueItems(result.queue || []);
    } catch (error: any) {
      console.error("Error fetching queue:", error);
      toast.error("Failed to load moderation queue");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (
    item: ModerationQueueItem,
    actionType: ModerationActionType
  ) => {
    setCurrentAction({ item, type: actionType });
    setNewRating(item.current_rating);
    setNewComment(item.current_comment);
    setActionReason("");
    setActionNotes("");
    setShowActionDialog(true);
  };

  const executeAction = async () => {
    if (!currentAction) return;

    const { item, type } = currentAction;

    if ((type === "reject" || type === "edit" || type === "escalate") && !actionReason) {
      toast.error("Reason is required for this action");
      return;
    }

    try {
      setProcessing(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Please sign in");
        return;
      }

      const payload: any = {
        queueItemId: item.queue_id,
        action: type,
        reason: actionReason || undefined,
        notes: actionNotes || undefined,
      };

      if (type === "edit") {
        payload.newRating = newRating;
        payload.newComment = newComment;
      }

      if (type === "escalate") {
        payload.escalationType = escalationType;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/moderate-feedback`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) throw new Error("Failed to execute moderation action");

      const result = await response.json();

      if (result.success) {
        toast.success(`Feedback ${type}d successfully`);
        setShowActionDialog(false);
        setCurrentAction(null);
        fetchQueue();
      } else {
        toast.error(result.error || "Action failed");
      }
    } catch (error: any) {
      console.error("Error executing action:", error);
      toast.error("Failed to execute action");
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkAction = async (action: "approve" | "reject") => {
    if (selectedItems.size === 0) {
      toast.error("Please select items to moderate");
      return;
    }

    if (
      action === "reject" &&
      !confirm("Are you sure you want to reject selected items?")
    ) {
      return;
    }

    try {
      setProcessing(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Please sign in");
        return;
      }

      const reason =
        action === "reject"
          ? prompt("Enter reason for bulk rejection:")
          : undefined;

      if (action === "reject" && !reason) {
        toast.error("Reason is required for rejection");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-moderate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            queueItemIds: Array.from(selectedItems),
            action,
            reason,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to execute bulk action");

      const result = await response.json();

      toast.success(
        `Bulk action completed: ${result.succeeded} succeeded, ${result.failed} failed`
      );
      setSelectedItems(new Set());
      fetchQueue();
    } catch (error: any) {
      console.error("Error executing bulk action:", error);
      toast.error("Failed to execute bulk action");
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelection = (queueId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(queueId)) {
      newSelection.delete(queueId);
    } else {
      newSelection.add(queueId);
    }
    setSelectedItems(newSelection);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: "default", className: "bg-yellow-100 text-yellow-800" },
      approved: { variant: "default", className: "bg-green-100 text-green-800" },
      rejected: { variant: "default", className: "bg-red-100 text-red-800" },
      flagged: { variant: "default", className: "bg-orange-100 text-orange-800" },
      escalated: { variant: "default", className: "bg-purple-100 text-purple-800" },
    };

    return (
      <Badge {...(variants[status] || {})}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return <div className="p-8 text-center">Loading moderation queue...</div>;
  }

  return (
    <div className="space-y-6">
      <ModerationFiltersComponent
        filters={filters}
        onFiltersChange={setFilters}
        onApply={fetchQueue}
      />

      {/* Bulk Actions */}
      {selectedItems.size > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedItems.size} item(s) selected
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleBulkAction("approve")}
                  disabled={processing}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Bulk Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleBulkAction("reject")}
                  disabled={processing}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Bulk Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedItems(new Set())}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue Items */}
      <div className="space-y-4">
        {queueItems.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No items in moderation queue
            </CardContent>
          </Card>
        ) : (
          queueItems.map((item) => (
            <Card key={item.queue_id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedItems.has(item.queue_id)}
                      onCheckedChange={() => toggleSelection(item.queue_id)}
                    />
                    <div>
                      <CardTitle className="text-lg">{item.product_name}</CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <User className="h-4 w-4" />
                        {item.reviewer_name}
                        <Clock className="h-4 w-4 ml-2" />
                        {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(item.status)}
                    {item.priority > 0 && (
                      <Badge variant="outline">Priority: {item.priority}</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Rating */}
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{item.current_rating}/5</span>
                </div>

                {/* Comment */}
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm">{item.current_comment}</p>
                </div>

                {/* Auto-moderation Flags */}
                {item.auto_flags && item.auto_flags.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Auto-moderation Flags:</Label>
                    <div className="flex flex-wrap gap-2">
                      {item.auto_flags.map((flag, idx) => (
                        <Badge
                          key={idx}
                          variant="destructive"
                          className={flag.overridden ? "opacity-50 line-through" : ""}
                        >
                          <Flag className="mr-1 h-3 w-3" />
                          {flag.flag_type} ({(flag.confidence * 100).toFixed(0)}%)
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Flagged Reason */}
                {item.flagged_reason && (
                  <div className="bg-orange-50 p-3 rounded border-l-4 border-orange-400">
                    <Label className="text-sm font-medium text-orange-900">
                      Flagged Reason:
                    </Label>
                    <p className="text-sm text-orange-800 mt-1">{item.flagged_reason}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleAction(item, "approve")}
                    disabled={processing}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleAction(item, "reject")}
                    disabled={processing}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(item, "edit")}
                    disabled={processing}
                  >
                    <Edit3 className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(item, "escalate")}
                    disabled={processing}
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Escalate
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {currentAction?.type.charAt(0).toUpperCase()}
              {currentAction?.type.slice(1)} Feedback
            </DialogTitle>
            <DialogDescription>
              {currentAction?.type === "approve" &&
                "Approve this feedback to make it visible publicly"}
              {currentAction?.type === "reject" &&
                "Reject this feedback and provide a reason"}
              {currentAction?.type === "edit" &&
                "Edit the feedback content (original is preserved in audit log)"}
              {currentAction?.type === "escalate" &&
                "Escalate this feedback to another team"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {currentAction?.type === "edit" && (
              <>
                <div className="space-y-2">
                  <Label>Rating</Label>
                  <Select
                    value={newRating.toString()}
                    onValueChange={(value) => setNewRating(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <SelectItem key={rating} value={rating.toString()}>
                          {rating} Star{rating > 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Comment</Label>
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={4}
                    placeholder="Edit comment..."
                  />
                </div>
              </>
            )}

            {currentAction?.type === "escalate" && (
              <div className="space-y-2">
                <Label>Escalation Type</Label>
                <Select
                  value={escalationType}
                  onValueChange={(value) => setEscalationType(value as EscalationType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="legal">Legal</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="high_priority">High Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {currentAction?.type !== "approve" && (
              <div className="space-y-2">
                <Label>
                  Reason <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  rows={3}
                  placeholder="Enter reason for this action..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows={2}
                placeholder="Additional notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowActionDialog(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button onClick={executeAction} disabled={processing}>
              {processing ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
