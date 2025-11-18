import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Package } from "lucide-react";
import { User } from "@supabase/supabase-js";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface OrderItem {
  id: string;
  quantity: number;
  price_at_purchase: number;
  product: {
    name: string;
    image_url: string | null;
  } | null;
}

interface Order {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  delivery_address: string;
  notes: string | null;
  payment_method: string | null;
  order_items: OrderItem[];
}

const Orders = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        fetchOrders(session.user.id);
      }
    });
  }, [navigate]);

  const fetchOrders = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          total_amount,
          status,
          delivery_address,
          notes,
          payment_method,
          order_items (
            id,
            quantity,
            price_at_purchase,
            product:products (
              name,
              image_url
            )
          )
        `)
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data as unknown as Order[]);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      confirmed: "bg-blue-500",
      processing: "bg-indigo-500",
      shipped: "bg-purple-500",
      delivered: "bg-green-500",
      cancelled: "bg-red-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    if (status === "cancelled") return "destructive";
    if (status === "delivered") return "default";
    return "secondary";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-64 bg-muted rounded"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-8">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">My Orders</h1>
            <p className="text-muted-foreground">View your order history and track status</p>
          </div>
        </div>

        {orders.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No orders yet</h3>
              <p className="text-muted-foreground mb-4">
                Start shopping to see your orders here
              </p>
              <Button onClick={() => navigate("/")}>
                Browse Products
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">Order #{order.id.slice(0, 8)}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                    <Badge variant={getStatusVariant(order.status)}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="details" className="border-none">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex justify-between items-center w-full pr-4">
                          <span className="font-medium">Order Details</span>
                          <span className="text-lg font-bold text-primary">
                            ₹{order.total_amount.toFixed(2)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-4">
                          {/* Order Items */}
                          <div>
                            <h4 className="font-semibold mb-3">Items</h4>
                            <div className="space-y-2">
                              {order.order_items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                                >
                                  {item.product?.image_url && (
                                    <img
                                      src={item.product.image_url}
                                      alt={item.product.name}
                                      className="w-12 h-12 rounded object-cover"
                                    />
                                  )}
                                  <div className="flex-1">
                                    <p className="font-medium">
                                      {item.product?.name || "Product unavailable"}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      Quantity: {item.quantity} × ₹{item.price_at_purchase.toFixed(2)}
                                    </p>
                                  </div>
                                  <p className="font-semibold">
                                    ₹{(item.quantity * item.price_at_purchase).toFixed(2)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <Separator />

                          {/* Delivery Information */}
                          <div>
                            <h4 className="font-semibold mb-2">Delivery Address</h4>
                            <p className="text-sm text-muted-foreground">
                              {order.delivery_address}
                            </p>
                          </div>

                          {/* Payment Method */}
                          {order.payment_method && (
                            <div>
                              <h4 className="font-semibold mb-2">Payment Method</h4>
                              <p className="text-sm text-muted-foreground uppercase">
                                {order.payment_method.replace("_", " ")}
                              </p>
                            </div>
                          )}

                          {/* Notes */}
                          {order.notes && (
                            <div>
                              <h4 className="font-semibold mb-2">Notes</h4>
                              <p className="text-sm text-muted-foreground">{order.notes}</p>
                            </div>
                          )}

                          <Separator />

                          {/* Total */}
                          <div className="flex justify-between items-center pt-2">
                            <span className="text-lg font-bold">Total Amount</span>
                            <span className="text-2xl font-bold text-primary">
                              ₹{order.total_amount.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
