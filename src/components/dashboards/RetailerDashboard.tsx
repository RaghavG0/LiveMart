import { useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Plus, Package, BarChart3, Store, User as UserIcon, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductForm } from "@/components/products/ProductForm";
import { ProductList } from "@/components/products/ProductList";
import WholesalerProductGrid from "@/components/WholesalerProductGrid";
import { useSellerLocation } from "@/hooks/useSellerLocation";
import { LocationStatusBanner } from "@/components/LocationStatusBanner";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import NotificationBell from "@/components/NotificationBell";

interface RetailerDashboardProps {
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

const RetailerDashboard = ({ user }: RetailerDashboardProps) => {
  const navigate = useNavigate();
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="bg-card shadow-md border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Live MART - Retailer Portal
            </h1>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate("/seller-orders")} title="Manage Orders">
                <ShoppingBag className="h-5 w-5" />
              </Button>
              <NotificationBell />
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
          <h2 className="text-3xl font-bold mb-2">Retailer Dashboard</h2>
          <p className="text-muted-foreground">Manage your inventory and orders</p>
        </div>

        <LocationStatusBanner show={hasLocation === false && !locationLoading} />

        <Tabs defaultValue="products" className="space-y-6">
          <TabsList>
            <TabsTrigger value="products">
              <Package className="h-4 w-4 mr-2" />
              My Products
            </TabsTrigger>
            <TabsTrigger value="wholesalers">
              <Store className="h-4 w-4 mr-2" />
              Wholesaler Marketplace
            </TabsTrigger>
            <TabsTrigger value="orders">
              <BarChart3 className="h-4 w-4 mr-2" />
              Orders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-4">
            <ProductList
              onEdit={handleEditProduct}
              onAdd={handleAddProduct}
              refreshTrigger={refreshTrigger}
            />
          </TabsContent>

          <TabsContent value="wholesalers" className="space-y-4">
            <h3 className="text-xl font-semibold">Browse & Order from Wholesalers</h3>
            <p className="text-muted-foreground mb-4">
              Discover products from wholesalers and place bulk orders directly
            </p>
            <WholesalerProductGrid />
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <h3 className="text-xl font-semibold">Recent Orders</h3>
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No orders yet. They'll appear here once customers start ordering!</p>
            </div>
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
              Your shop location is required to list products. Customers use location to find nearby shops and products.
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

export default RetailerDashboard;
