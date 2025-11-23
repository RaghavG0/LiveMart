import { useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Plus, Package, BarChart3, Store, User as UserIcon, ShoppingBag, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductForm } from "@/components/products/ProductForm";
import { ProductList } from "@/components/products/ProductList";
import WholesalerProductGrid from "@/components/WholesalerProductGrid";
import { useSellerLocation } from "@/hooks/useSellerLocation";
import { LocationStatusBanner } from "@/components/LocationStatusBanner";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import NotificationBell from "@/components/NotificationBell";
import PendingInventoryOrders from "@/components/PendingInventoryOrders";
import RetailerFeedbackOverview from "@/components/dashboard/RetailerFeedbackOverview";
import OrderStatusManager from "@/components/dashboard/OrderStatusManager";
import LowStockAlert from "@/components/alerts/LowStockAlert";

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
                <span className="text-sm md:text-base ml-2 text-white/80">- Retailer</span>
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
          <h2 className="text-2xl md:text-3xl font-bold mb-2 text-gray-900">Retailer Dashboard</h2>
          <p className="text-gray-600">Manage your inventory and orders</p>
        </div>

        <LocationStatusBanner show={hasLocation === false && !locationLoading} />

        {/* Low Stock Alert */}
        <LowStockAlert 
          outOfStockCount={outOfStockCount} 
          onManageProducts={() => {
            // Focus on products tab when "Manage Products" is clicked
            const productsTab = document.querySelector('[value="products"]') as HTMLElement;
            if (productsTab) productsTab.click();
          }}
        />

        {/* Pending Inventory Orders */}
        <div className="mb-6">
          <PendingInventoryOrders 
            userId={user.id} 
            onInventoryAdded={() => setRefreshTrigger((prev) => prev + 1)}
          />
        </div>

        <Tabs defaultValue="products" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-gray-100">
            <TabsTrigger value="products" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <Package className="h-4 w-4 mr-2" />
              My Products
            </TabsTrigger>
            <TabsTrigger value="wholesalers" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <Store className="h-4 w-4 mr-2" />
              Wholesaler Marketplace
            </TabsTrigger>
            <TabsTrigger value="orders" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <BarChart3 className="h-4 w-4 mr-2" />
              Order Management
            </TabsTrigger>
            <TabsTrigger value="feedback" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <BarChart3 className="h-4 w-4 mr-2" />
              Customer Feedback
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-4">
            <ProductList
              onEdit={handleEditProduct}
              onAdd={handleAddProduct}
              refreshTrigger={refreshTrigger}
              onStockCountChange={setOutOfStockCount}
            />
          </TabsContent>

          <TabsContent value="wholesalers" className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">Browse & Order from Wholesalers</h3>
            <p className="text-gray-600 mb-4">
              Discover products from wholesalers and place bulk orders directly
            </p>
            <WholesalerProductGrid />
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <OrderStatusManager sellerId={user.id} orderType="customer" />
          </TabsContent>

          <TabsContent value="feedback" className="space-y-4">
            <RetailerFeedbackOverview retailerId={user.id} />
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
