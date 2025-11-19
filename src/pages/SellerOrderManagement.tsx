import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import { Package, CheckCircle, Truck, XCircle, ArrowLeft } from "lucide-react";

interface Order {
  id: string;
  status: string;
  total_amount: number;
  delivery_address: string;
  created_at: string;
  customer_id: string;
  order_items: Array<{
    quantity: number;
    price_at_purchase: number;
    products: {
      name: string;
      image_url: string;
    };
  }>;
}

const SellerOrderManagement = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("pending");

  useEffect(() => {
    fetchOrders();
    
    // Real-time subscription
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
  }, []);

  const fetchOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get orders where user is the seller (their products are in order_items)
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            quantity,
            price_at_purchase,
            products (
              name,
              image_url,
              seller_id
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter orders that contain products from this seller
      const sellerOrders = data?.filter(order =>
        order.order_items.some(item => item.products?.seller_id === user.id)
      ) || [];

      setOrders(sellerOrders as Order[]);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled") => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (error) throw error;
      
      toast.success(`Order ${newStatus}`);
      fetchOrders();
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Failed to update order status");
    }
  };

  const filterOrdersByStatus = (status: string) => {
    return orders.filter(order => order.status === status);
  };

  const renderOrderCard = (order: Order) => (
    <Card key={order.id} className="mb-4">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">Order #{order.id.slice(0, 8)}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(order.created_at).toLocaleString()}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Delivery Address</p>
          <p className="text-sm">{order.delivery_address}</p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-2">Items</p>
          {order.order_items.map((item, idx) => (
            <div key={idx} className="flex gap-3 mb-2">
              {item.products?.image_url && (
                <img
                  src={item.products.image_url}
                  alt={item.products.name}
                  className="w-12 h-12 object-cover rounded"
                />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">{item.products?.name}</p>
                <p className="text-xs text-muted-foreground">
                  Qty: {item.quantity} × ₹{item.price_at_purchase}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div>
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-xl font-bold">₹{order.total_amount}</p>
          </div>
          
          <div className="flex gap-2">
            {order.status === "pending" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateOrderStatus(order.id, "cancelled")}
                  className="gap-1"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateOrderStatus(order.id, "confirmed")}
                  className="gap-1"
                >
                  <CheckCircle className="w-4 h-4" />
                  Confirm
                </Button>
              </>
            )}
            {order.status === "confirmed" && (
              <Button
                size="sm"
                onClick={() => updateOrderStatus(order.id, "processing")}
                className="gap-1"
              >
                <Package className="w-4 h-4" />
                Start Processing
              </Button>
            )}
            {order.status === "processing" && (
              <Button
                size="sm"
                onClick={() => updateOrderStatus(order.id, "shipped")}
                className="gap-1"
              >
                <Truck className="w-4 h-4" />
                Mark as Shipped
              </Button>
            )}
            {order.status === "shipped" && (
              <Button
                size="sm"
                onClick={() => updateOrderStatus(order.id, "delivered")}
                className="gap-1"
              >
                <CheckCircle className="w-4 h-4" />
                Mark as Delivered
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Order Management</h1>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="pending">
              Pending
              <Badge variant="secondary" className="ml-2">
                {filterOrdersByStatus("pending").length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="confirmed">
              Confirmed
              <Badge variant="secondary" className="ml-2">
                {filterOrdersByStatus("confirmed").length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="processing">
              Processing
              <Badge variant="secondary" className="ml-2">
                {filterOrdersByStatus("processing").length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="shipped">
              Shipped
              <Badge variant="secondary" className="ml-2">
                {filterOrdersByStatus("shipped").length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="delivered">
              Delivered
              <Badge variant="secondary" className="ml-2">
                {filterOrdersByStatus("delivered").length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {["pending", "confirmed", "processing", "shipped", "delivered"].map(status => (
            <TabsContent key={status} value={status} className="mt-6">
              {loading ? (
                <p className="text-center text-muted-foreground">Loading orders...</p>
              ) : filterOrdersByStatus(status).length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">No {status} orders</p>
                  </CardContent>
                </Card>
              ) : (
                filterOrdersByStatus(status).map(renderOrderCard)
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
};

export default SellerOrderManagement;
