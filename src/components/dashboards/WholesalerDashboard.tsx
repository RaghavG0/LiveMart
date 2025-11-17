import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Plus, Package, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WholesalerDashboardProps {
  user: User;
}

const WholesalerDashboard = ({ user }: WholesalerDashboardProps) => {
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
              Live MART - Wholesaler Portal
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
          <h2 className="text-3xl font-bold mb-2">Wholesaler Dashboard</h2>
          <p className="text-muted-foreground">Manage your bulk inventory and retailer orders</p>
        </div>

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
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">Bulk Inventory</h3>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </div>
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No inventory yet. Start by adding your first bulk product!</p>
            </div>
          </TabsContent>

          <TabsContent value="retailers" className="space-y-4">
            <h3 className="text-xl font-semibold">Retailer Orders</h3>
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No retailer orders yet. They'll appear here once retailers start ordering!</p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default WholesalerDashboard;
