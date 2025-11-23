import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateInvoice } from "@/lib/invoiceGenerator";

interface OrderDetails {
  id: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  delivery_address: string;
  created_at: string;
  order_items: Array<{
    product: {
      name: string;
      price: number;
    };
    quantity: number;
    price_at_purchase: number;
  }>;
}

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Payment Successful";
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          total_amount,
          payment_method,
          payment_status,
          delivery_address,
          created_at,
          order_items (
            quantity,
            price_at_purchase,
            product:products (
              name,
              price
            )
          )
        `)
        .eq("id", orderId)
        .single();

      if (error) throw error;
      setOrderDetails(data as unknown as OrderDetails);
    } catch (error: any) {
      console.error("Error fetching order details:", error);
      toast.error("Failed to load order details");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!orderDetails || !orderId) return;

    try {
      // Fetch user profile for invoice
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .single();

      await generateInvoice({
        orderId: orderDetails.id,
        orderDate: orderDetails.created_at,
        customerName: profile?.full_name || user.email || "Customer",
        customerEmail: user.email || "",
        customerPhone: profile?.phone || "",
        deliveryAddress: orderDetails.delivery_address,
        items: orderDetails.order_items.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.price_at_purchase,
          total: item.quantity * item.price_at_purchase,
        })),
        totalAmount: orderDetails.total_amount,
        paymentMethod: orderDetails.payment_method === "cod" ? "Cash on Delivery" : "PayU",
        paymentStatus: orderDetails.payment_status,
      });

      toast.success("Invoice downloaded successfully!");
    } catch (error: any) {
      console.error("Error generating invoice:", error);
      toast.error("Failed to generate invoice: " + error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">Loading order details...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            Your order has been placed successfully
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {orderId && (
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Order ID</p>
              <p className="font-mono font-semibold">{orderId}</p>
            </div>
          )}

          {orderDetails && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Amount</span>
                <span className="font-semibold">₹{orderDetails.total_amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Payment Method</span>
                <span className="font-semibold">
                  {orderDetails.payment_method === "cod" ? "Cash on Delivery" : "PayU"}
                </span>
              </div>
            </div>
          )}
          
          <p className="text-sm text-center text-muted-foreground">
            We've sent a confirmation email with your order details. You can track your order status in real-time.
          </p>

          <div className="space-y-2 pt-4">
            <Button 
              onClick={handleDownloadInvoice}
              variant="outline"
              className="w-full"
              disabled={!orderDetails}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Invoice
            </Button>
            <Button 
              onClick={() => navigate(orderId ? `/order-tracking/${orderId}` : "/orders")} 
              className="w-full"
            >
              Track Order
            </Button>
            <Button 
              onClick={() => navigate("/")} 
              variant="outline"
              className="w-full"
            >
              Continue Shopping
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
