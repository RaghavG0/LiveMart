import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, MessageSquare, MapPin, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import OrderTimeline from "@/components/OrderTimeline";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import { useRealtimeOrder } from "@/hooks/useRealtimeOrder";

const OrderTracking = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  
  const { order, loading, isConnected } = useRealtimeOrder(orderId, {
    showNotifications: true,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8 flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Order not found</p>
            <Button onClick={() => navigate("/orders")} className="mt-4">
              View All Orders
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/orders")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Orders
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-2xl">Track Order</CardTitle>
                  <Badge variant={isConnected ? "default" : "secondary"} className="gap-1">
                    {isConnected ? (
                      <>
                        <Wifi className="w-3 h-3" />
                        Live
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3" />
                        Offline
                      </>
                    )}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Order ID: {order.id}
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-4">Order Status</h3>
                <OrderTimeline currentStatus={order.status} />
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Delivery Address</h3>
                  <div className="flex gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <p className="text-muted-foreground">{order.delivery_address}</p>
                  </div>
                </div>

                {order.estimated_delivery && (
                  <div>
                    <h3 className="font-semibold mb-2">Estimated Delivery</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.estimated_delivery).toLocaleString()}
                    </p>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold mb-2">Order Total</h3>
                  <p className="text-2xl font-bold">₹{order.total_amount}</p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 gap-2">
                    <Phone className="w-4 h-4" />
                    Call Seller
                  </Button>
                  <Button variant="outline" className="flex-1 gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Message
                  </Button>
                </div>
              </div>
            </div>

            {/* Mock delivery map - replace with actual map when delivery_tracking table exists */}
            <div className="mt-6">
              <h3 className="font-semibold mb-4">Live Tracking</h3>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">
                  Map view will be available once order is shipped
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrderTracking;
