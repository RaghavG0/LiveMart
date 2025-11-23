import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Heart, User as UserIcon, LogOut, Search, Grid, Map, Package, Calendar, MessageSquare, ShoppingBag, Menu, Store, ArrowRight, Filter } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { getPickupCartItemCount } from "@/lib/pickupCart";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import ProductGrid from "@/components/ProductGrid";
import { Input } from "@/components/ui/input";
import FilterPanel, { FilterState } from "@/components/FilterPanel";
import { useUserLocation } from "@/hooks/useUserLocation";
import { LocationPermission } from "@/components/LocationPermission";
import MapView from "@/components/MapView";
import NotificationBell from "@/components/NotificationBell";
import { reverseGeocode, type AddressComponents } from "@/lib/reverseGeocode";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface CustomerDashboardProps {
  user: User;
}

const CustomerDashboard = ({ user }: CustomerDashboardProps) => {
  const navigate = useNavigate();
  const { location, loading: locationLoading, refetch: refetchLocation } = useUserLocation();
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
    categoryId: null,
    subcategoryId: null,
  });
  const [searchParams] = useSearchParams();
  const isPickupMode = searchParams.get('pickup') === 'true';
  const [pickupCartCount, setPickupCartCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchMaxPrice();
    fetchUserProfile();
    fetchCounts();
    if (isPickupMode) {
      updatePickupCartCount();
      const interval = setInterval(updatePickupCartCount, 1000);
      return () => clearInterval(interval);
    }
  }, [isPickupMode]);
  
  const updatePickupCartCount = () => {
    setPickupCartCount(getPickupCartItemCount());
  };

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
            <div className="flex items-center gap-2 md:gap-3">
              {/* Delivery Info - Hidden on mobile */}
              <div className="hidden lg:flex items-center gap-2 text-white text-sm">
                <span className="flex items-center gap-1">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                  Order now and get it within 15 min!
                </span>
              </div>
              
              {/* My Orders - with label */}
              <div className="flex flex-col items-center gap-0.5">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => navigate("/orders")} 
                  className="text-white hover:text-primary hover:bg-white/10"
                  title="My Orders"
                >
                  <Package className="h-5 w-5" />
                </Button>
                <span className="text-[10px] text-white/90 hidden sm:block">Orders</span>
              </div>

              {/* Offline Pickup - with label */}
              <div className="flex flex-col items-center gap-0.5">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => navigate("/offline-pickup")} 
                  className="text-white hover:text-primary hover:bg-white/10"
                  title="Store Pickup"
                >
                  <Store className="h-5 w-5" />
                </Button>
                <span className="text-[10px] text-white/90 hidden sm:block">Pickup</span>
              </div>
              
              <div className="flex flex-col items-center gap-0.5">
                <Button variant="ghost" size="icon" onClick={() => navigate("/wishlist")} className="relative text-white hover:text-primary hover:bg-white/10">
                  <Heart className="h-5 w-5" />
                  {wishlistCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                      {wishlistCount}
                    </span>
                  )}
                </Button>
                <span className="text-[10px] text-white/90 hidden sm:block">Wishlist</span>
              </div>

              <div className="flex flex-col items-center gap-0.5">
                <Button variant="ghost" size="icon" onClick={() => navigate("/cart")} className="relative text-white hover:text-primary hover:bg-white/10">
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                      {cartCount}
                    </span>
                  )}
                </Button>
                <span className="text-[10px] text-white/90 hidden sm:block">Cart</span>
              </div>

              <div className="flex flex-col items-center gap-0.5">
                <NotificationBell />
                <span className="text-[10px] text-white/90 hidden sm:block">Notifications</span>
              </div>
              
              <div className="flex flex-col items-center gap-0.5">
                <Button variant="ghost" size="icon" onClick={() => navigate("/account")} className="text-white hover:text-primary hover:bg-white/10">
                  <UserIcon className="h-5 w-5" />
                </Button>
                <span className="text-[10px] text-white/90 hidden sm:block">Account</span>
              </div>

              <div className="flex flex-col items-center gap-0.5">
                <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-white hover:text-primary hover:bg-white/10">
                  <LogOut className="h-5 w-5" />
                </Button>
                <span className="text-[10px] text-white/90 hidden sm:block">Logout</span>
              </div>
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
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(true)}
              className="bg-white hover:bg-gray-50"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
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

        {/* Pickup Mode Banner */}
        {isPickupMode && (
          <div className="mb-6 p-4 bg-green-50 border-2 border-green-500 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-6 w-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900">Store Pickup Mode</h3>
                <p className="text-sm text-green-700">
                  Products you add will go to your pickup cart. {pickupCartCount > 0 && `${pickupCartCount} item${pickupCartCount > 1 ? 's' : ''} selected.`}
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/offline-pickup')}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Go to Pickup Page
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Location Permission Banner */}
        {!location && showLocationBanner && (
          <LocationPermission 
            onLocationGranted={async (lat, lng) => {
              try {
                // Get address components
                let addressComponents: AddressComponents | null = null;
                
                try {
                  addressComponents = await reverseGeocode(lat, lng);
                } catch (error) {
                  console.error('Reverse geocoding failed:', error);
                }

                // Save location to user profile for future use
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                  const updateData: any = {
                    location_lat: lat,
                    location_lng: lng,
                  };

                  // Add address components if available
                  if (addressComponents) {
                    updateData.location_address = addressComponents.formatted_address;
                    updateData.location_area = addressComponents.area || null;
                    updateData.location_city = addressComponents.city || null;
                    updateData.location_district = addressComponents.district || null;
                    updateData.location_state = addressComponents.state || null;
                    updateData.location_country = addressComponents.country || null;
                    updateData.location_pincode = addressComponents.pincode || null;
                  }

                  // Save location to profile (non-blocking)
                  supabase
                    .from('profiles')
                    .update(updateData)
                    .eq('id', user.id)
                    .then(() => {
                      console.log('Location saved to profile');
                    })
                    .catch((err) => {
                      console.error('Failed to save location to profile:', err);
                    });
                }
                
                // Refetch location to update state
                await refetchLocation();
                setShowLocationBanner(false);
                
                // Show success message with location details
                if (addressComponents?.city || addressComponents?.state) {
                  const locationParts = [addressComponents.area, addressComponents.city, addressComponents.state, addressComponents.pincode].filter(Boolean);
                  toast.success(`Location enabled! ${locationParts.length > 0 ? locationParts.join(', ') : 'You can now see nearby shops'}`);
                } else {
                  toast.success("Location enabled! You can now see nearby shops");
                }
              } catch (error) {
                console.error('Failed to update location:', error);
                toast.error("Failed to update location. Please try again.");
              }
            }}
            onDismiss={() => setShowLocationBanner(false)}
          />
        )}

        {viewMode === 'grid' ? (
          <ProductGrid 
            searchQuery={searchQuery}
            priceRange={filters.priceRange}
            minStock={filters.minStock}
            inStockOnly={filters.inStockOnly}
            sortBy={filters.sortBy}
            userLocation={location}
            maxDistance={filters.maxDistance}
            sellerId={selectedSellerId}
            categoryId={filters.categoryId}
            subcategoryId={filters.subcategoryId}
          />
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

        {/* Filters Sheet/Drawer */}
        <Sheet open={showFilters} onOpenChange={setShowFilters}>
          <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <FilterPanel 
                filters={filters} 
                onFiltersChange={(newFilters) => {
                  setFilters(newFilters);
                }}
                maxPrice={maxPrice}
                hasLocation={!!location}
                variant="modal"
              />
            </div>
          </SheetContent>
        </Sheet>
      </main>
    </div>
  );
};

export default CustomerDashboard;
