import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Plus, Package, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RetailerDashboardProps {
  user: User;
}

const RetailerDashboard = ({ user }: RetailerDashboardProps) => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
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
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Retailer Dashboard</h2>
          <p className="text-muted-foreground">Manage your inventory and orders</p>
        </div>

        <Tabs defaultValue="products" className="space-y-6">
          <TabsList>
            <TabsTrigger value="products">
              <Package className="h-4 w-4 mr-2" />
              Products
            </TabsTrigger>
            <TabsTrigger value="orders">
              <BarChart3 className="h-4 w-4 mr-2" />
              Orders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">Your Products</h3>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </div>
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No products yet. Start by adding your first product!</p>
            </div>
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
    </div>
  );
};

export default RetailerDashboard;
