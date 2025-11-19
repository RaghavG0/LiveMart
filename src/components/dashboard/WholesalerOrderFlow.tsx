import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Clock, CheckCircle, XCircle, TrendingUp, Star, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface OrderStatusHistoryItem {
  id: string;
  previous_status: string | null;
  new_status: string;
  notes: string | null;
  created_at: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  price_at_purchase: number;
  products: {
    name: string;
    image_url: string | null;
  };
}

interface RetailerOrder {
  id: string;
  customer_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  delivery_address: string;
  notes: string | null;
  order_items: OrderItem[];
  status_history: OrderStatusHistoryItem[];
  retailer_name?: string;
  retailer_phone?: string;
  feedback?: {
    avg_rating: number;
    review_count: number;
    reviews: Array<{
      rating: number;
      comment: string;
      created_at: string;
    }>;
  };
}

interface WholesalerOrderFlowProps {
  wholesalerId: string;
}

export default function WholesalerOrderFlow({ wholesalerId }: WholesalerOrderFlowProps) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<RetailerOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<RetailerOrder | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchOrders();
  }, [wholesalerId, statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("orders")
        .select(`
          *,
          order_items(
            id,
            quantity,
            price_at_purchase,
            product_id,
            products(name, image_url)
          )
        `)
        .eq("seller_id", wholesalerId)
        .eq("order_type", "retailer")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) throw ordersError;

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Fetch retailer profiles
      const retailerIds = [...new Set(ordersData.map((o) => o.customer_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", retailerIds);

      if (profilesError) throw profilesError;

      // Fetch status history for all orders
      const orderIds = ordersData.map((o) => o.id);
      const { data: statusHistory, error: historyError } = await supabase
        .from("order_status_history")
        .select("*")
        .in("order_id", orderIds)
        .order("created_at", { ascending: true });

      if (historyError) throw historyError;

      // For delivered orders, fetch related reviews
      const deliveredOrders = ordersData.filter((o) => o.status === "delivered");
      const productIds = deliveredOrders.flatMap((o) =>
        o.order_items.map((item: any) => item.product_id)
      );

      let feedbackMap = new Map<string, any>();
      if (productIds.length > 0) {
        // Get products that retailers created from wholesaler products
        const { data: retailerProducts, error: rpError } = await supabase
          .from("products")
          .select("id, name, seller_id")
          .in("seller_id", retailerIds);

        if (!rpError && retailerProducts) {
          // Match retailer products to wholesaler products by name
          const wholesalerProductNames = new Map<string, string>();
          for (const orderId of orderIds) {
            const order = ordersData.find((o) => o.id === orderId);
            if (order) {
              order.order_items.forEach((item: any) => {
                if (item.products?.name) {
                  wholesalerProductNames.set(item.product_id, item.products.name);
                }
              });
            }
          }

          // Get reviews for matching products
          const matchingRetailerProductIds = retailerProducts
            .filter((rp) => {
              const productName = Array.from(wholesalerProductNames.values()).find(
                (name) => name === rp.name
              );
              return productName !== undefined;
            })
            .map((rp) => rp.id);

          if (matchingRetailerProductIds.length > 0) {
            const { data: reviews, error: reviewsError } = await supabase
              .from("reviews")
              .select("product_id, rating, comment, created_at")
              .in("product_id", matchingRetailerProductIds);

            if (!reviewsError && reviews) {
              // Group reviews by order (via retailer and product name)
              deliveredOrders.forEach((order) => {
                const orderReviews = reviews.filter((review) => {
                  const reviewProduct = retailerProducts.find((rp) => rp.id === review.product_id);
                  if (!reviewProduct) return false;
                  
                  // Check if this review is for a product in this order
                  return order.order_items.some((item: any) =>
                    item.products?.name === reviewProduct.name &&
                    reviewProduct.seller_id === order.customer_id
                  );
                });

                if (orderReviews.length > 0) {
                  const avgRating = orderReviews.reduce((sum, r) => sum + r.rating, 0) / orderReviews.length;
                  feedbackMap.set(order.id, {
                    avg_rating: avgRating,
                    review_count: orderReviews.length,
                    reviews: orderReviews,
                  });
                }
              });
            }
          }
        }
      }

      // Enrich orders with all data
      const enrichedOrders = ordersData.map((order) => {
        const profile = profiles?.find((p) => p.id === order.customer_id);
        const history = (statusHistory || []).filter((h) => h.order_id === order.id);
        const feedback = feedbackMap.get(order.id);

        return {
          ...order,
          retailer_name: profile?.full_name || "Unknown Retailer",
          retailer_phone: profile?.phone,
          status_history: history,
          feedback,
        };
      });

      setOrders(enrichedOrders);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "confirmed":
        return "bg-blue-100 text-blue-800";
      case "processing":
        return "bg-purple-100 text-purple-800";
      case "shipped":
        return "bg-indigo-100 text-indigo-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "confirmed":
      case "processing":
        return <Package className="h-4 w-4" />;
      case "delivered":
        return <CheckCircle className="h-4 w-4" />;
      case "cancelled":
        return <XCircle className="h-4 w-4" />;
      default:
        return <TrendingUp className="h-4 w-4" />;
    }
  };

  const statusCounts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    confirmed: orders.filter((o) => o.status === "confirmed").length,
    processing: orders.filter((o) => o.status === "processing").length,
    shipped: orders.filter((o) => o.status === "shipped").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Order Flow Visibility</h2>
          <p className="text-muted-foreground">
            Track retailer orders, status history, and related feedback
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders ({statusCounts.all})</SelectItem>
            <SelectItem value="pending">Pending ({statusCounts.pending})</SelectItem>
            <SelectItem value="confirmed">Confirmed ({statusCounts.confirmed})</SelectItem>
            <SelectItem value="processing">Processing ({statusCounts.processing})</SelectItem>
            <SelectItem value="shipped">Shipped ({statusCounts.shipped})</SelectItem>
            <SelectItem value="delivered">Delivered ({statusCounts.delivered})</SelectItem>
            <SelectItem value="cancelled">Cancelled ({statusCounts.cancelled})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
            <p className="text-xs text-muted-foreground">
              {orders.filter((o) => o.status === "pending").length} pending
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orders.filter((o) => ["confirmed", "processing", "shipped"].includes(o.status)).length}
            </div>
            <p className="text-xs text-muted-foreground">Being fulfilled</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orders.filter((o) => o.status === "delivered").length}
            </div>
            <p className="text-xs text-muted-foreground">Successfully delivered</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Feedback</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orders.filter((o) => o.feedback && o.feedback.review_count > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">Have reviews</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Retailer Orders</CardTitle>
          <CardDescription>Click an order to see full details and status history</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading orders...</div>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground">
                No orders found {statusFilter !== "all" && `with status "${statusFilter}"`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedOrder(order);
                    setShowDetailsDialog(true);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={getStatusColor(order.status)}>
                        {getStatusIcon(order.status)}
                        <span className="ml-1">{order.status}</span>
                      </Badge>
                      {order.feedback && (
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-semibold">{order.feedback.avg_rating.toFixed(1)}</span>
                          <span className="text-muted-foreground">
                            ({order.feedback.review_count} reviews)
                          </span>
                        </div>
                      )}
                    </div>
                    <h4 className="font-semibold">{order.retailer_name}</h4>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span>Order #{order.id.substring(0, 8)}</span>
                      <span>•</span>
                      <span>{order.order_items.length} items</span>
                      <span>•</span>
                      <span>{new Date(order.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">${order.total_amount.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">
                      {order.status_history.length} status updates
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              Complete order information, status history, and customer feedback
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6 py-4">
              {/* Order Info */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Order Information</h4>
                  <div className="space-y-1 text-sm">
                    <div><span className="text-muted-foreground">Order ID:</span> {selectedOrder.id}</div>
                    <div><span className="text-muted-foreground">Retailer:</span> {selectedOrder.retailer_name}</div>
                    {selectedOrder.retailer_phone && (
                      <div><span className="text-muted-foreground">Phone:</span> {selectedOrder.retailer_phone}</div>
                    )}
                    <div><span className="text-muted-foreground">Date:</span> {new Date(selectedOrder.created_at).toLocaleString()}</div>
                    <div><span className="text-muted-foreground">Total:</span> ${selectedOrder.total_amount.toFixed(2)}</div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Delivery Address</h4>
                  <p className="text-sm text-muted-foreground">{selectedOrder.delivery_address}</p>
                  {selectedOrder.notes && (
                    <div className="mt-3">
                      <h4 className="font-semibold mb-1">Notes</h4>
                      <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h4 className="font-semibold mb-3">Order Items</h4>
                <div className="space-y-2">
                  {selectedOrder.order_items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      {item.products.image_url ? (
                        <img
                          src={item.products.image_url}
                          alt={item.products.name}
                          className="h-12 w-12 object-cover rounded"
                        />
                      ) : (
                        <div className="h-12 w-12 bg-muted rounded flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{item.products.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Quantity: {item.quantity} × ${item.price_at_purchase.toFixed(2)}
                        </div>
                      </div>
                      <div className="font-semibold">
                        ${(item.quantity * item.price_at_purchase).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status History */}
              <div>
                <h4 className="font-semibold mb-3">Status History</h4>
                <div className="space-y-3">
                  {selectedOrder.status_history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No status updates yet</p>
                  ) : (
                    selectedOrder.status_history.map((history) => (
                      <div key={history.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10">
                            {getStatusIcon(history.new_status)}
                          </div>
                          <div className="w-px h-full bg-border mt-1" />
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={getStatusColor(history.new_status)}>
                              {history.new_status}
                            </Badge>
                            {history.previous_status && (
                              <span className="text-sm text-muted-foreground">
                                from {history.previous_status}
                              </span>
                            )}
                          </div>
                          {history.notes && (
                            <p className="text-sm text-muted-foreground">{history.notes}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(history.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Customer Feedback */}
              {selectedOrder.feedback && selectedOrder.feedback.review_count > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Customer Feedback
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{selectedOrder.feedback.avg_rating.toFixed(1)}</div>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < Math.round(selectedOrder.feedback!.avg_rating)
                                  ? "text-yellow-500 fill-yellow-500"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Based on {selectedOrder.feedback.review_count} review{selectedOrder.feedback.review_count !== 1 ? 's' : ''}
                      </div>
                    </div>
                    {selectedOrder.feedback.reviews.filter(r => r.comment).map((review, idx) => (
                      <div key={idx} className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${
                                  i < review.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm">{review.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
