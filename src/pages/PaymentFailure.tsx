import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PaymentFailure = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reason = searchParams.get("reason") || "Payment processing failed";

  useEffect(() => {
    document.title = "Payment Failed";
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl">Payment Failed</CardTitle>
          <CardDescription>
            We couldn't process your payment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Reason</p>
            <p className="text-sm">{reason}</p>
          </div>
          
          <p className="text-sm text-center text-muted-foreground">
            Your order has not been placed. Please try again or choose a different payment method.
          </p>

          <div className="space-y-2 pt-4">
            <Button 
              onClick={() => navigate("/checkout")} 
              className="w-full"
            >
              Try Again
            </Button>
            <Button 
              onClick={() => navigate("/cart")} 
              variant="outline"
              className="w-full"
            >
              Back to Cart
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentFailure;
