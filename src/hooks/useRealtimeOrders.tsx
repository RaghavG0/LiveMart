import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";

interface Order {
  id: string;
  status: string;
  delivery_address: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  payment_method?: string;
  payment_status?: string;
  notes?: string;
  order_items: Array<{
    id: string;
    quantity: number;
    price_at_purchase: number;
    product: {
      id: string;
      name: string;
      image_url: string;
    } | null;
  }>;
}

interface UseRealtimeOrdersOptions {
  showNotifications?: boolean;
}

export const useRealtimeOrders = (
  userId: string | undefined,
  options: UseRealtimeOrdersOptions = {}
) => {
  const { showNotifications = true } = options;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            id,
            quantity,
            price_at_purchase,
            product:products (
              id,
              name,
              image_url
            )
          )
        `)
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setOrders(data as Order[]);
    } catch (err: any) {
      console.error("Error fetching orders:", err);
      setError(err.message);
      if (showNotifications) {
        toast.error("Failed to load orders");
      }
    } finally {
      setLoading(false);
    }
  }, [userId, showNotifications]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchOrders();

    // Set up real-time subscription for all user's orders
    const channel: RealtimeChannel = supabase
      .channel(`user-orders-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `customer_id=eq.${userId}`,
        },
        (payload) => {
          console.log("Order change detected:", payload);

          if (payload.eventType === "INSERT") {
            // New order created
            fetchOrders();
            if (showNotifications) {
              toast.success("New order created!");
            }
          } else if (payload.eventType === "UPDATE") {
            // Order updated
            const updatedOrder = payload.new as Order;
            const oldOrder = payload.old as Order;

            setOrders((prev) =>
              prev.map((order) =>
                order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order
              )
            );

            // Show notification for status changes
            if (oldOrder?.status && updatedOrder?.status && oldOrder.status !== updatedOrder.status) {
              if (showNotifications) {
                toast.success(`Order #${updatedOrder.id.slice(0, 8)} status: ${updatedOrder.status}`, {
                  description: updatedOrder.notes || "Your order has been updated",
                });
              }
            }
          } else if (payload.eventType === "DELETE") {
            // Order deleted
            const deletedId = payload.old.id;
            setOrders((prev) => prev.filter((order) => order.id !== deletedId));
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`Orders subscription status:`, status);
        
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
        } else if (status === "CHANNEL_ERROR") {
          setIsConnected(false);
          console.error("Channel error:", err);
          if (showNotifications) {
            toast.error("Lost connection. Reconnecting...");
          }
        } else if (status === "CLOSED") {
          setIsConnected(false);
        }
      });

    // Cleanup
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchOrders, showNotifications]);

  return {
    orders,
    loading,
    error,
    isConnected,
    refetch: fetchOrders,
  };
};
