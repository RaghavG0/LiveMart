import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Heart, User as UserIcon, LogOut, Search, Grid, Map, Package, Calendar, MessageSquare, ShoppingBag, Menu } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import ProductGrid from "@/components/ProductGrid";
import { Input } from "@/components/ui/input";
import FilterPanel, { FilterState } from "@/components/FilterPanel";
import { useUserLocation } from "@/hooks/useUserLocation";
import { LocationPermission } from "@/components/LocationPermission";
import MapView from "@/components/MapView";
import NotificationBell from "@/components/NotificationBell";

interface CustomerDashboardProps {
  user: User;
}

const CustomerDashboard = ({ user }: CustomerDashboardProps) => {
  const navigate = useNavigate();
  const { location, loading: locationLoading } = useUserLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState(1000);
  const [showLocationBanner, setShowLocationBanner] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, 1000],
    minStock: 0,
    inStockOnly: false,
    sortBy: "none",
    maxDistance: null,
    nearbyOnly: false,
  });

  useEffect(() => {
    fetchMaxPrice();
    fetchUserProfile();
    fetchCounts();
  }, []);

  const fetchCounts = async () => {
    try {
      const [cartData, wishlistData] = await Promise.all([
        supabase.from('cart_items').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('wishlist_items').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      ]);

      setCartCount(cartData.count || 0);
      setWishlistCount(wishlistData.count || 0);
    } catch (error) {
      console.error('Error fetching counts:', error);
    }
  };

  const fetchUserProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    
    if (data?.full_name) {
      setUserName(data.full_name);
    }
  };

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
              </span>
            </Link>
            
            {/* Middle - Search Bar */}
            <div className="flex-1 max-w-2xl mx-4 md:mx-8 hidden md:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  type="search"
                  placeholder="Search for Grocery, Stores, Vegetable or Meat"
                  className="pl-10 bg-white/90 backdrop-blur-sm border-white/20 text-gray-900 placeholder:text-gray-500 focus:bg-white"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Right Side - Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Delivery Info - Hidden on mobile */}
              <div className="hidden lg:flex items-center gap-2 text-white text-sm">
                <span className="flex items-center gap-1">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                  Order now and get it within 15 min!
                </span>
              </div>
              
              <Button variant="ghost" size="icon" onClick={() => navigate("/wishlist")} className="relative text-white hover:text-primary hover:bg-white/10">
                <Heart className="h-5 w-5" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {wishlistCount}
                  </span>
                )}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigate("/cart")} className="relative text-white hover:text-primary hover:bg-white/10">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {cartCount}
                  </span>
                )}
              </Button>
              <NotificationBell />
              <Button variant="ghost" size="icon" onClick={() => navigate("/account")} className="text-white hover:text-primary hover:bg-white/10">
                <UserIcon className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-white hover:text-primary hover:bg-white/10">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          {/* Mobile Search Bar */}
          <div className="md:hidden pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="search"
                placeholder="Search for Grocery, Stores, Vegetable or Meat"
                className="pl-10 bg-white/90 backdrop-blur-sm border-white/20 text-gray-900 placeholder:text-gray-500 focus:bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 bg-white">
        <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2 text-gray-900">
              Welcome back{userName && `, ${userName}`}!
            </h2>
            <p className="text-gray-600">Discover amazing products from local retailers</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className={viewMode === 'grid' ? 'bg-primary hover:bg-primary/90' : ''}
            >
              <Grid className="h-4 w-4 mr-2" />
              Grid View
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('map')}
              className={viewMode === 'map' ? 'bg-primary hover:bg-primary/90' : ''}
            >
              <Map className="h-4 w-4 mr-2" />
              Map View
            </Button>
          </div>
        </div>

        {/* Location Permission Banner */}
        {!location && showLocationBanner && (
          <LocationPermission 
            onLocationGranted={() => {
              setShowLocationBanner(false);
              toast.success("Location enabled! You can now see nearby shops");
            }}
            onDismiss={() => setShowLocationBanner(false)}
          />
        )}

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <aside className="lg:col-span-1">
              <FilterPanel 
                filters={filters} 
                onFiltersChange={setFilters}
                maxPrice={maxPrice}
                hasLocation={!!location}
              />
            </aside>
            <div className="lg:col-span-3">
              <ProductGrid 
                searchQuery={searchQuery}
                priceRange={filters.priceRange}
                minStock={filters.minStock}
                inStockOnly={filters.inStockOnly}
                sortBy={filters.sortBy}
                userLocation={location}
                maxDistance={filters.maxDistance}
                sellerId={selectedSellerId}
              />
            </div>
          </div>
        ) : (
          <MapView 
            userLocation={location}
            onSellerSelect={(sellerId) => {
              setSelectedSellerId(sellerId);
              setViewMode('grid');
              toast.success('Showing products from selected shop');
            }}
          />
        )}
      </main>
    </div>
  );
};

export default CustomerDashboard;
