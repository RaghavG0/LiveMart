import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Plus, Package, TrendingUp, CheckCircle, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
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

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;
      toast.success("Order status updated successfully");
      fetchRetailerOrders();
    } catch (error: any) {
      toast.error("Failed to update order status: " + error.message);
    }
  };

  useEffect(() => {
    fetchRetailerOrders();
  }, [user.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="bg-card shadow-md border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Live MART - Wholesaler Portal
            </h1>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate("/account")} title="Account Settings">
                <UserIcon className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Wholesaler Dashboard</h2>
          <p className="text-muted-foreground">Manage your bulk inventory and retailer orders</p>
        </div>

        <LocationStatusBanner show={hasLocation === false && !locationLoading} />

        <Tabs defaultValue="inventory" className="space-y-6">
          <TabsList>
            <TabsTrigger value="inventory">
              <Package className="h-4 w-4 mr-2" />
              Inventory
            </TabsTrigger>
            <TabsTrigger value="retailers">
              <TrendingUp className="h-4 w-4 mr-2" />
              Retailers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-4">
            <ProductList
              onEdit={handleEditProduct}
              onAdd={handleAddProduct}
              refreshTrigger={refreshTrigger}
            />
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
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
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
