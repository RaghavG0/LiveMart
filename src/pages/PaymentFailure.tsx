import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PaymentFailure = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [orderExists, setOrderExists] = useState(false);

  useEffect(() => {
    document.title = "Payment Failed";
    if (orderId) {
      checkOrderExists();
    }
  }, [orderId]);

  const checkOrderExists = async () => {
    if (!orderId) return;

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, payment_status")
        .eq("id", orderId)
        .single();

      if (!error && data) {
        setOrderExists(true);
        // Optionally update payment status to failed
        if (data.payment_status !== "failed") {
          await supabase
            .from("orders")
            .update({ payment_status: "failed" })
            .eq("id", orderId);
        }
      }
    } catch (error) {
      console.error("Error checking order:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl">Payment Failed</CardTitle>
          <CardDescription>
            Your payment could not be processed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {orderId && (
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Order ID</p>
              <p className="font-mono font-semibold">{orderId}</p>
            </div>
          )}
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>What happened?</strong>
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Your payment could not be completed. This could be due to insufficient funds, incorrect card details, or a technical issue.
            </p>
          </div>

          <p className="text-sm text-center text-muted-foreground">
            Don't worry, your order is saved. You can retry the payment or contact support for assistance.
          </p>

          <div className="space-y-2 pt-4">
            {orderExists && orderId && (
              <Button 
                onClick={() => navigate(`/checkout?retry=${orderId}`)} 
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Payment
              </Button>
            )}
            <Button 
              onClick={() => navigate("/orders")} 
              variant="outline"
              className="w-full"
            >
              View My Orders
            </Button>
            <Button 
              onClick={() => navigate("/")} 
              variant="ghost"
              className="w-full"
            >
              Go to Homepage
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentFailure;
