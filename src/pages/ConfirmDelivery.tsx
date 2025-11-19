import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, AlertCircle, Package, Star } from "lucide-react";
import { toast } from "sonner";

interface OrderDetails {
  id: string;
  status: string;
  deliveryAddress: string;
  totalAmount: number;
}

type ConfirmationStatus = "loading" | "success" | "error" | "expired" | "used";

const ConfirmDelivery = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ConfirmationStatus>("loading");
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    
    if (!token) {
      setStatus("error");
      setErrorMessage("Invalid confirmation link - missing token");
      return;
    }

    confirmDelivery(token);
  }, [searchParams]);

  const confirmDelivery = async (token: string) => {
    try {
      setStatus("loading");

      const { data, error } = await supabase.functions.invoke("confirm-delivery", {
        body: { token },
      });

      if (error) throw error;

      if (!data.success) {
        // Handle specific error cases
        if (data.error === "ALREADY_USED") {
          setStatus("used");
          setErrorMessage("This delivery has already been confirmed");
        } else if (data.error === "EXPIRED") {
          setStatus("expired");
          setErrorMessage("This confirmation link has expired");
        } else if (data.error === "INVALID_TOKEN") {
          setStatus("error");
          setErrorMessage("Invalid confirmation link");
        } else {
          setStatus("error");
          setErrorMessage(data.message || "Failed to confirm delivery");
        }
        return;
      }

      // Success
      setStatus("success");
      setOrderDetails(data.orderDetails);
      toast.success("Delivery confirmed successfully! 🎉");
    } catch (err: any) {
      console.error("Confirmation error:", err);
      setStatus("error");
      setErrorMessage(err.message || "An unexpected error occurred");
      toast.error("Failed to confirm delivery");
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <Skeleton className="h-8 w-48 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success" && orderDetails) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Delivery Confirmed!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-muted-foreground">
                Thank you for confirming your delivery. Your order has been marked as delivered.
              </p>
            </div>

            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Order ID</p>
                  <p className="font-medium">{orderDetails.id.slice(0, 8)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="font-medium text-lg">₹{orderDetails.totalAmount}</p>
              </div>
            </div>

            <div className="pt-4 border-t space-y-3">
              <p className="text-sm font-medium text-center">How was your experience?</p>
              <Button
                onClick={() => navigate(`/orders`)}
                className="w-full gap-2"
              >
                <Star className="w-4 h-4" />
                Leave a Review
              </Button>
              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="w-full"
              >
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error states
  const getIcon = () => {
    if (status === "expired" || status === "used") {
      return <AlertCircle className="w-10 h-10 text-orange-600 dark:text-orange-400" />;
    }
    return <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />;
  };

  const getTitle = () => {
    if (status === "expired") return "Link Expired";
    if (status === "used") return "Already Confirmed";
    return "Confirmation Failed";
  };

  const getColorClass = () => {
    if (status === "expired" || status === "used") {
      return "bg-orange-100 dark:bg-orange-900/20";
    }
    return "bg-red-100 dark:bg-red-900/20";
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className={`mx-auto mb-4 w-16 h-16 rounded-full ${getColorClass()} flex items-center justify-center`}>
            {getIcon()}
          </div>
          <CardTitle className="text-2xl">{getTitle()}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-muted-foreground">{errorMessage}</p>
          </div>

          {(status === "expired" || status === "used") && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                {status === "expired" 
                  ? "This confirmation link has expired. Please contact the seller for a new confirmation link."
                  : "This delivery has already been confirmed. No further action is needed."
                }
              </p>
            </div>
          )}

          <div className="space-y-3">
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
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmDelivery;
