import { useEffect, useState } from "react";
import { usePendingFeedback } from "@/hooks/usePendingFeedback";
import DeliveryFeedbackModal from "./DeliveryFeedbackModal";
import { supabase } from "@/integrations/supabase/client";

export const PendingFeedbackChecker = () => {
  const { pendingOrders, hasPending, loading, markAsCompleted } = usePendingFeedback();
  const [showModal, setShowModal] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<{
    orderId: string;
    orderTotal: number;
  } | null>(null);

  useEffect(() => {
    if (!loading && hasPending && pendingOrders.length > 0) {
      // Show modal for the first pending order
      const firstOrder = pendingOrders[0];
      setCurrentOrder({
        orderId: firstOrder.order_id,
        orderTotal: firstOrder.order_total,
      });
      setShowModal(true);
    }
  }, [loading, hasPending, pendingOrders]);

  const handleClose = () => {
    setShowModal(false);
    // Optionally mark as dismissed (not completed)
    // This allows user to skip for now but still see it later
  };

  const handleComplete = async () => {
    if (currentOrder) {
      await markAsCompleted(currentOrder.orderId);
      setShowModal(false);
      
      // Find next pending order
      const remainingOrders = pendingOrders.filter(
        (o) => o.order_id !== currentOrder.orderId
      );
      
      if (remainingOrders.length > 0) {
        // Show next order after a brief delay
        setTimeout(() => {
          const nextOrder = remainingOrders[0];
          setCurrentOrder({
            orderId: nextOrder.order_id,
            orderTotal: nextOrder.order_total,
          });
          setShowModal(true);
        }, 1000);
      } else {
        setCurrentOrder(null);
      }
    }
  };

  if (!currentOrder) return null;

  return (
    <DeliveryFeedbackModal
      open={showModal}
      orderId={currentOrder.orderId}
      orderTotal={currentOrder.orderTotal}
      onClose={handleClose}
      onComplete={handleComplete}
    />
  );
};

export default PendingFeedbackChecker;

