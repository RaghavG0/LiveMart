import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, Clock, ChevronRight, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Order {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  delivery_address: string;
  customer_name: string;
  updated_at: string;
  order_items: Array<{
    quantity: number;
    product: {
      name: string;
    } | null;
  }>;
}

interface OrderStatusManagerProps {
  sellerId: string;
  orderType?: "customer" | "retailer";
}

const validStatuses = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const OrderStatusManager = ({ sellerId, orderType = "customer" }: OrderStatusManagerProps) => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchOrders();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('seller-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sellerId, orderType]);

  const fetchOrders = async () => {
    try {
      setLoading(true);

      // Query orders where seller owns products
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          updated_at,
          total_amount,
          status,
          delivery_address,
          order_type,
          profiles!orders_customer_id_fkey(full_name),
          order_items!inner(
            quantity,
            product:products!inner(
              name,
              seller_id
            )
          )
        `)
        .eq("order_items.product.seller_id", sellerId)
        .eq("order_type", orderType)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Format data
      const formattedOrders: Order[] = (data || []).map((order: any) => ({
        id: order.id,
        created_at: order.created_at,
        updated_at: order.updated_at,
        total_amount: order.total_amount,
        status: order.status,
        delivery_address: order.delivery_address,
        customer_name: order.profiles?.full_name || "Unknown",
        order_items: order.order_items,
      }));

      setOrders(formattedOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedOrder || !newStatus) return;

    try {
      setUpdating(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Authentication required");
        return;
      }

      const { data, error } = await supabase.functions.invoke("update-order-status", {
        body: {
          orderId: selectedOrder.id,
          newStatus,
          notes: notes.trim() || undefined,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message);
        setDialogOpen(false);
        setSelectedOrder(null);
        setNewStatus("");
        setNotes("");
        fetchOrders();
      }
    } catch (error: any) {
      console.error("Error updating order status:", error);
      toast.error(error.message || "Failed to update order status");
    } finally {
      setUpdating(false);
    }
  };

  const openStatusDialog = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setNotes("");
    setDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Recent Orders
          </CardTitle>
          <CardDescription>
            Manage order statuses and track deliveries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">Order #{order.id.slice(0, 8)}</h4>
                        <OrderStatusBadge status={order.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Customer: {order.customer_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {order.order_items.length} items • ₹{order.total_amount.toFixed(2)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openStatusDialog(order)}
                    >
                      Update Status
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Created: {formatDate(order.created_at)}</span>
                    {order.updated_at !== order.created_at && (
                      <>
                        <span>•</span>
                        <span>Updated: {formatDate(order.updated_at)}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Update Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>
              Change the status for Order #{selectedOrder?.id.slice(0, 8)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Status</Label>
              <div>
                <OrderStatusBadge status={selectedOrder?.status || ""} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-status">New Status *</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger id="new-status">
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  {validStatuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this status update..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={updating}>
              Cancel
            </Button>
            <Button
              onClick={handleStatusUpdate}
              disabled={updating || !newStatus || newStatus === selectedOrder?.status}
            >
              {updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Status"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OrderStatusManager;
