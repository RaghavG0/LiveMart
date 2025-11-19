import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";

interface OrderUpdate {
  id: string;
  status: string;
  delivery_address: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  estimated_delivery?: string;
  delivery_lat?: number;
  delivery_lng?: number;
  notes?: string;
}

interface UseRealtimeOrderOptions {
  onStatusChange?: (oldStatus: string, newStatus: string) => void;
  showNotifications?: boolean;
}

export const useRealtimeOrder = (
  orderId: string | undefined,
  options: UseRealtimeOrderOptions = {}
) => {
  const { onStatusChange, showNotifications = true } = options;
  const [order, setOrder] = useState<OrderUpdate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (fetchError) throw fetchError;
      setOrder(data);
    } catch (err: any) {
      console.error("Error fetching order:", err);
      setError(err.message);
      if (showNotifications) {
        toast.error("Failed to load order details");
      }
    } finally {
      setLoading(false);
    }
  }, [orderId, showNotifications]);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchOrder();

    // Set up real-time subscription
    let channel: RealtimeChannel;
    let reconnectTimeout: NodeJS.Timeout;

    const setupSubscription = () => {
      channel = supabase
        .channel(`order-${orderId}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: `id=eq.${orderId}`,
          },
          (payload) => {
            console.log("Order updated (realtime):", payload);
            
            const newOrder = payload.new as OrderUpdate;
            const oldOrder = payload.old as OrderUpdate;

            // Update local state
            setOrder(newOrder);

            // Notify about status change
            if (oldOrder?.status && newOrder?.status && oldOrder.status !== newOrder.status) {
              if (showNotifications) {
                toast.success(`Order status updated to: ${newOrder.status}`, {
                  description: newOrder.notes || "Your order has been updated",
                });
              }
              onStatusChange?.(oldOrder.status, newOrder.status);
            }

            // Reset retry count on successful update
            setRetryCount(0);
          }
        )
        .subscribe((status, err) => {
          console.log(`Subscription status for order ${orderId}:`, status);
          
          if (status === "SUBSCRIBED") {
            setIsConnected(true);
            setRetryCount(0);
          } else if (status === "CHANNEL_ERROR") {
            setIsConnected(false);
            console.error("Channel error:", err);
            
            // Implement exponential backoff for reconnection
            const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
            console.log(`Reconnecting in ${delay}ms...`);
            
            reconnectTimeout = setTimeout(() => {
              setRetryCount(prev => prev + 1);
              fetchOrder(); // Refresh data on reconnect
            }, delay);
          } else if (status === "CLOSED") {
            setIsConnected(false);
          }
        });
    };

    setupSubscription();

    // Cleanup function
    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [orderId, fetchOrder, onStatusChange, showNotifications, retryCount]);

  return {
    order,
    loading,
    error,
    isConnected,
    refetch: fetchOrder,
  };
};
