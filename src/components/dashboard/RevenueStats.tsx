import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, Package, TrendingUp, ShoppingCart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface RevenueStatsProps {
  sellerId: string;
  orderType: "customer" | "retailer";
}

interface RevenueData {
  totalRevenue: number;
  totalProductsSold: number;
  totalOrders: number;
  deliveredOrders: number;
}

const RevenueStats = ({ sellerId, orderType }: RevenueStatsProps) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<RevenueData>({
    totalRevenue: 0,
    totalProductsSold: 0,
    totalOrders: 0,
    deliveredOrders: 0,
  });

  useEffect(() => {
    fetchRevenueStats();
  }, [sellerId, orderType]);

  const fetchRevenueStats = async () => {
    try {
      setLoading(true);

      // Fetch all orders for this seller
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          total_amount,
          status,
          order_items!inner(
            quantity,
            product:products!inner(
              seller_id
            )
          )
        `)
        .eq("order_items.product.seller_id", sellerId)
        .eq("order_type", orderType);

      if (ordersError) {
        console.error("Error fetching orders:", ordersError);
        throw ordersError;
      }

      if (!ordersData || ordersData.length === 0) {
        setStats({
          totalRevenue: 0,
          totalProductsSold: 0,
          totalOrders: 0,
          deliveredOrders: 0,
        });
        setLoading(false);
        return;
      }

      // Calculate statistics
      let totalRevenue = 0;
      let totalProductsSold = 0;
      let deliveredOrders = 0;

      ordersData.forEach((order: any) => {
        // Add to total revenue
        totalRevenue += order.total_amount || 0;

        // Count products sold from order items
        if (order.order_items && Array.isArray(order.order_items)) {
          order.order_items.forEach((item: any) => {
            totalProductsSold += item.quantity || 0;
          });
        }

        // Count delivered orders
        if (order.status === "delivered") {
          deliveredOrders++;
        }
      });

      setStats({
        totalRevenue,
        totalProductsSold,
        totalOrders: ordersData.length,
        deliveredOrders,
      });
    } catch (error: any) {
      console.error("Error fetching revenue stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Revenue */}
      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-green-900">Total Revenue</CardTitle>
          <IndianRupee className="h-5 w-5 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-900">
            ₹{stats.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-green-700 mt-1">From all orders</p>
        </CardContent>
      </Card>

      {/* Products Sold */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-blue-900">Products Sold</CardTitle>
          <Package className="h-5 w-5 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-900">
            {stats.totalProductsSold.toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-blue-700 mt-1">Total items sold</p>
        </CardContent>
      </Card>

      {/* Total Orders */}
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-purple-900">Total Orders</CardTitle>
          <ShoppingCart className="h-5 w-5 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-900">
            {stats.totalOrders.toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-purple-700 mt-1">All time orders</p>
        </CardContent>
      </Card>

      {/* Delivered Orders */}
      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-orange-900">Delivered</CardTitle>
          <TrendingUp className="h-5 w-5 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-900">
            {stats.deliveredOrders.toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-orange-700 mt-1">Successfully delivered</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RevenueStats;

