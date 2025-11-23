import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PendingOrder {
  order_id: string;
  order_total: number;
  order_date: string;
  delivery_address: string;
}

export const usePendingFeedback = () => {
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    checkPendingFeedback();
  }, []);

  const checkPendingFeedback = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("check-pending-feedback");

      if (error) throw error;

      if (data?.success) {
        const orders = data.pendingOrders || [];
        setPendingOrders(orders);
        setHasPending(orders.length > 0);
      }
    } catch (error) {
      console.error("Error checking pending feedback:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsCompleted = async (orderId: string) => {
    // Remove from pending list
    setPendingOrders((prev) => prev.filter((o) => o.order_id !== orderId));
    setHasPending(pendingOrders.length > 1);
  };

  return {
    pendingOrders,
    hasPending,
    loading,
    refresh: checkPendingFeedback,
    markAsCompleted,
  };
};

