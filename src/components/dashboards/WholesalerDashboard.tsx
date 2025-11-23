import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Plus, Package, TrendingUp, CheckCircle, User as UserIcon, ShoppingBag, AlertTriangle, Users, Download, BarChart3, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductForm } from "@/components/products/ProductForm";
import { ProductList } from "@/components/products/ProductList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSellerLocation } from "@/hooks/useSellerLocation";
import { LocationStatusBanner } from "@/components/LocationStatusBanner";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import NotificationBell from "@/components/NotificationBell";
import WholesalerFeedbackView from "@/components/dashboard/WholesalerFeedbackView";
import OrderStatusManager from "@/components/dashboard/OrderStatusManager";
import AggregatedSKUFeedback from "@/components/dashboard/AggregatedSKUFeedback";
import ProblemSKUAlerts from "@/components/dashboard/ProblemSKUAlerts";
import RetailerInsights from "@/components/dashboard/RetailerInsights";
import WholesalerOrderFlow from "@/components/dashboard/WholesalerOrderFlow";
import { exportSKUPerformance, exportComplaintLogs, exportCompleteReport } from "@/lib/exportUtils";
import LowStockAlert from "@/components/alerts/LowStockAlert";
import RevenueStats from "@/components/dashboard/RevenueStats";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WholesalerDashboardProps {
  user: User;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock_quantity: number;
  category_id?: string;
  is_available: boolean;
  availability_date?: string;
  image_url?: string;
}

type OrderStatus = "cancelled" | "confirmed" | "delivered" | "pending" | "processing" | "shipped";

interface RetailerOrder {
  id: string;
  customer_id: string;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
  delivery_address: string;
  payment_method?: string;
  order_items: Array<{
    id: string;
    quantity: number;
    price_at_purchase: number;
    products: {
      name: string;
      image_url?: string;
    };
  }>;
}

const WholesalerDashboard = ({ user }: WholesalerDashboardProps) => {
  const navigate = useNavigate();
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [retailerOrders, setRetailerOrders] = useState<RetailerOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const { hasLocation, loading: locationLoading } = useSellerLocation(user?.id);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const handleAddProduct = () => {
    if (hasLocation === false) {
      setShowLocationPrompt(true);
      return;
    }
    setEditingProduct(undefined);
    setShowProductForm(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowProductForm(true);
  };

  const handleFormSuccess = () => {
    setShowProductForm(false);
    setEditingProduct(undefined);
    setRefreshTrigger((prev) => prev + 1);
  };

  const fetchRetailerOrders = async () => {
    setLoading(true);
    try {
      const { data: ordersData, error } = await supabase
        .from("orders")
        .select(`
          id,
          customer_id,
          total_amount,
          status,
          created_at,
          delivery_address,
          payment_method,
          order_items(
            id,
            quantity,
            price_at_purchase,
            products(name, image_url)
          )
        `)
        .eq("order_type", "retailer")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch retailer profiles separately
      const retailerIds = ordersData?.map(o => o.customer_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", retailerIds);

      const ordersWithProfiles = ordersData?.map(order => ({
        ...order,
        retailer: profiles?.find(p => p.id === order.customer_id)
      })) || [];

      setRetailerOrders(ordersWithProfiles as any);
    } catch (error: any) {
      toast.error("Failed to fetch retailer orders: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    try {
      setUpdatingStatus(orderId);
      
      const { data, error } = await supabase.functions.invoke("update-order-status", {
        body: {
          orderId,
          newStatus,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message || "Order status updated successfully");
        fetchRetailerOrders();
      } else {
        throw new Error(data?.error || "Failed to update order status");
      }
    } catch (error: any) {
      toast.error("Failed to update order status: " + error.message);
    } finally {
      setUpdatingStatus(null);
    }
  };

  useEffect(() => {
    fetchRetailerOrders();
  }, [user.id]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-gradient-hero shadow-lg border-b border-primary-dark/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Left Side - Logo */}
            <Link to="/" className="flex items-center space-x-2 group">
              <div className="relative">
                <ShoppingBag className="h-8 w-8 md:h-10 md:w-10 text-white transition-transform group-hover:scale-110" />
                <div className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full animate-pulse" />
              </div>
              <span className="text-xl md:text-2xl font-bold text-white">
                Live<span className="text-primary">Mart</span>
                <span className="text-sm md:text-base ml-2 text-white/80">- Wholesaler</span>
              </span>
            </Link>
            
            {/* Right Side - Action Buttons */}
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex flex-col items-center gap-0.5">
                <Button variant="ghost" size="icon" onClick={() => navigate("/seller-orders")} title="Manage Orders" className="text-white hover:text-primary hover:bg-white/10">
                  <ShoppingBag className="h-5 w-5" />
                </Button>
                <span className="text-[10px] text-white/90 hidden sm:block">Orders</span>
              </div>
              
              <div className="flex flex-col items-center gap-0.5">
                <NotificationBell />
                <span className="text-[10px] text-white/90 hidden sm:block">Notifications</span>
              </div>

              <div className="flex flex-col items-center gap-0.5">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => navigate("/support-chat")} 
                  className="text-white hover:text-primary hover:bg-white/10"
                  title="Support Chat"
                >
                  <MessageCircle className="h-5 w-5" />
                </Button>
                <span className="text-[10px] text-white/90 hidden sm:block">Support</span>
              </div>
              
              <div className="flex flex-col items-center gap-0.5">
                <Button variant="ghost" size="icon" onClick={() => navigate("/account")} title="Account Settings" className="text-white hover:text-primary hover:bg-white/10">
                  <UserIcon className="h-5 w-5" />
                </Button>
                <span className="text-[10px] text-white/90 hidden sm:block">Account</span>
              </div>
              
              <div className="flex flex-col items-center gap-0.5">
                <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out" className="text-white hover:text-primary hover:bg-white/10">
                  <LogOut className="h-5 w-5" />
                </Button>
                <span className="text-[10px] text-white/90 hidden sm:block">Logout</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 bg-white">
        <div className="mb-6 md:mb-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-2 text-gray-900">Wholesaler Dashboard</h2>
          <p className="text-gray-600">Manage your bulk inventory and retailer orders</p>
        </div>

        <LocationStatusBanner show={hasLocation === false && !locationLoading} />

        {/* Revenue Statistics */}
        <RevenueStats sellerId={user.id} orderType="retailer" />

        {/* Low Stock Alert */}
        <LowStockAlert 
          outOfStockCount={outOfStockCount} 
          onManageProducts={() => {
            // Focus on inventory tab when "Manage Products" is clicked
            const inventoryTab = document.querySelector('[value="inventory"]') as HTMLElement;
            if (inventoryTab) inventoryTab.click();
          }}
        />

        <Tabs defaultValue="inventory" className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="grid w-full max-w-4xl grid-cols-7 bg-gray-100">
              <TabsTrigger value="inventory" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                <Package className="h-4 w-4 mr-2" />
                Inventory
              </TabsTrigger>
              <TabsTrigger value="analytics" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="alerts" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Alerts
              </TabsTrigger>
              <TabsTrigger value="insights" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                <Users className="h-4 w-4 mr-2" />
                Insights
              </TabsTrigger>
              <TabsTrigger value="orders" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                <TrendingUp className="h-4 w-4 mr-2" />
                Order Flow
              </TabsTrigger>
              <TabsTrigger value="feedback" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                <CheckCircle className="h-4 w-4 mr-2" />
                Legacy View
              </TabsTrigger>
              <TabsTrigger value="retailers" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                <ShoppingBag className="h-4 w-4 mr-2" />
                History
              </TabsTrigger>
            </TabsList>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export Reports
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Export Data</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportSKUPerformance(user.id)}>
                  SKU Performance
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportComplaintLogs(user.id)}>
                  Complaint Logs
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportCompleteReport(user.id)}>
                  Complete Report (All Data)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <TabsContent value="inventory" className="space-y-4">
            <ProductList
              onEdit={handleEditProduct}
              onAdd={handleAddProduct}
              refreshTrigger={refreshTrigger}
              onStockCountChange={setOutOfStockCount}
            />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <AggregatedSKUFeedback wholesalerId={user.id} />
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <ProblemSKUAlerts wholesalerId={user.id} />
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <RetailerInsights wholesalerId={user.id} />
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <WholesalerOrderFlow wholesalerId={user.id} />
          </TabsContent>

          <TabsContent value="feedback" className="space-y-4">
            <WholesalerFeedbackView wholesalerId={user.id} />
          </TabsContent>

          <TabsContent value="retailers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Retailer Orders & Transaction History</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Loading orders...</p>
                  </div>
                ) : retailerOrders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No retailer orders yet. They'll appear here once retailers start ordering!</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Retailer</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Total Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {retailerOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-xs">
                            {order.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{(order as any).retailer?.full_name || "Unknown"}</p>
                              {(order as any).retailer?.phone && (
                                <p className="text-xs text-muted-foreground">{(order as any).retailer.phone}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {order.order_items.map((item) => (
                                <p key={item.id} className="text-sm">
                                  {item.products.name} × {item.quantity}
                                </p>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            ₹{order.total_amount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              order.status === "delivered" ? "default" :
                              order.status === "confirmed" ? "secondary" :
                              order.status === "cancelled" ? "destructive" :
                              "outline"
                            }>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={order.status}
                              onValueChange={(value) => handleStatusUpdate(order.id, value as OrderStatus)}
                              disabled={updatingStatus === order.id}
                            >
                              <SelectTrigger className="w-32" disabled={updatingStatus === order.id}>
                                <SelectValue placeholder={updatingStatus === order.id ? "Updating..." : undefined} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="confirmed">Confirmed</SelectItem>
                                <SelectItem value="processing">Processing</SelectItem>
                                <SelectItem value="shipped">Shipped</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={showProductForm} onOpenChange={setShowProductForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Product" : "Add New Product"}
            </DialogTitle>
          </DialogHeader>
          <ProductForm
            product={editingProduct}
            onSuccess={handleFormSuccess}
            onCancel={() => setShowProductForm(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={showLocationPrompt} onOpenChange={setShowLocationPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Shop Location Required</AlertDialogTitle>
            <AlertDialogDescription>
              Your shop location is required to list products. Retailers use location to find nearby wholesalers and products.
              Please set your location in Account Settings before adding products.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowLocationPrompt(false)}>
              Cancel
            </Button>
            <Button onClick={() => { setShowLocationPrompt(false); navigate('/account'); }}>
              Go to Account Settings
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WholesalerDashboard;
