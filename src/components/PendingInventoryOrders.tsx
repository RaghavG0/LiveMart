import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Package, Plus } from "lucide-react";
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

interface OrderItem {
  quantity: number;
  price_at_purchase: number;
  products: {
    name: string;
    image_url: string | null;
  };
}

interface PendingOrder {
  id: string;
  created_at: string;
  total_amount: number;
  order_items: OrderItem[];
}

interface PendingInventoryOrdersProps {
  userId: string;
  onInventoryAdded?: () => void;
}

const PendingInventoryOrders = ({ userId, onInventoryAdded }: PendingInventoryOrdersProps) => {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchPendingOrders();

    // Real-time subscription for order updates
    const channel = supabase
      .channel('pending-inventory-orders')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        () => {
          fetchPendingOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchPendingOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          total_amount,
          order_items (
            quantity,
            price_at_purchase,
            products (
              name,
              image_url
            )
          )
        `)
        .eq("customer_id", userId)
        .eq("order_type", "retailer")
        .eq("status", "delivered")
        .eq("inventory_added", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data as unknown as PendingOrder[]);
    } catch (error) {
      console.error("Error fetching pending orders:", error);
      toast.error("Failed to load pending inventory orders");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToInventory = async () => {
    if (!selectedOrder) return;

    setAdding(true);
    try {
      const { error } = await supabase.rpc("add_retailer_order_to_inventory", {
        _order_id: selectedOrder.id,
        _retailer_id: userId,
      });

      if (error) throw error;

      toast.success("Products added to your inventory successfully!");
      setSelectedOrder(null);
      fetchPendingOrders();
      onInventoryAdded?.();
    } catch (error) {
      console.error("Error adding to inventory:", error);
      toast.error("Failed to add products to inventory");
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Pending Inventory Addition
            </CardTitle>
            <Badge variant="secondary">{orders.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground mb-4">
            You have delivered orders from wholesalers. Add these products to your inventory to start selling them.
          </p>
          
          {orders.map((order) => (
            <Card key={order.id} className="bg-background">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-semibold">Order #{order.id.slice(0, 8)}</p>
                      <Badge variant="outline" className="text-xs">
                        {order.order_items.length} items
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {order.order_items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                          {item.products?.image_url && (
                            <img
                              src={item.products.image_url}
                              alt={item.products.name}
                              className="w-8 h-8 rounded object-cover"
                            />
                          )}
                          <span>
                            {item.products?.name} × {item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setSelectedOrder(order)}
                    className="gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add to Inventory
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Products to Inventory?</AlertDialogTitle>
            <AlertDialogDescription>
              This will add the following products from your order to your inventory. They will become available for customers to purchase.
              {selectedOrder && (
                <div className="mt-4 space-y-2">
                  {selectedOrder.order_items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 bg-muted rounded">
                      {item.products?.image_url && (
                        <img
                          src={item.products.image_url}
                          alt={item.products.name}
                          className="w-12 h-12 rounded object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{item.products?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Quantity: {item.quantity} × ₹{item.price_at_purchase}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={adding}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddToInventory} disabled={adding}>
              {adding ? "Adding..." : "Add to Inventory"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PendingInventoryOrders;
