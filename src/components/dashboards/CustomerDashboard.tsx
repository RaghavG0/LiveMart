import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Heart, User as UserIcon, LogOut, Search } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import ProductGrid from "@/components/ProductGrid";
import { Input } from "@/components/ui/input";
import FilterPanel, { FilterState } from "@/components/FilterPanel";

interface CustomerDashboardProps {
  user: User;
}

const CustomerDashboard = ({ user }: CustomerDashboardProps) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState(1000);
  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, 1000],
    minStock: 0,
    inStockOnly: false,
    sortBy: "none",
  });

  useEffect(() => {
    fetchMaxPrice();
  }, []);

  const fetchMaxPrice = async () => {
    const { data } = await supabase
      .from("products")
      .select("price")
      .order("price", { ascending: false })
      .limit(1)
      .single();
    
    if (data?.price) {
      const max = Math.ceil(data.price / 100) * 100;
      setMaxPrice(max);
      setFilters(prev => ({ ...prev, priceRange: [0, max] }));
    }
  };

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
              Live MART
            </h1>
            
            <div className="flex-1 max-w-2xl mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="search"
                  placeholder="Search products..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate("/wishlist")}>
                <Heart className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigate("/cart")}>
                <ShoppingCart className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigate("/account")}>
                <UserIcon className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Welcome back!</h2>
          <p className="text-muted-foreground">Discover amazing products from local retailers</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1">
            <FilterPanel 
              filters={filters} 
              onFiltersChange={setFilters}
              maxPrice={maxPrice}
            />
          </aside>
          <div className="lg:col-span-3">
            <ProductGrid 
              searchQuery={searchQuery}
              priceRange={filters.priceRange}
              minStock={filters.minStock}
              inStockOnly={filters.inStockOnly}
              sortBy={filters.sortBy}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default CustomerDashboard;
