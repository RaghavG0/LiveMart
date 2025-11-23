import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Heart, Package } from "lucide-react";
import { toast } from "sonner";
import { addToPickupCart, getPickupCart } from "@/lib/pickupCart";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
  image_url: string;
  is_available: boolean;
  seller_id?: string;
  seller_name?: string;
  seller_address?: string;
  distance_km?: number;
}

interface ProductGridProps {
  searchQuery: string;
  priceRange?: [number, number];
  minStock?: number;
  inStockOnly?: boolean;
  sortBy?: "none" | "price-asc" | "price-desc" | "distance-asc";
  userLocation?: { lat: number; lng: number } | null;
  maxDistance?: number | null;
  sellerId?: string | null;
  categoryId?: string | null;
}

const ProductGrid = ({ searchQuery, priceRange, minStock, inStockOnly, sortBy, userLocation, maxDistance, sellerId, categoryId }: ProductGridProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishlistItems, setWishlistItems] = useState<Set<string>>(new Set());
  const [pickupCartItems, setPickupCartItems] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPickupMode = searchParams.get('pickup') === 'true';

  useEffect(() => {
    fetchProducts();
    fetchWishlist();
    if (isPickupMode) {
      loadPickupCart();
    }
  }, [searchQuery, priceRange, minStock, inStockOnly, sortBy, userLocation, maxDistance, sellerId, categoryId, isPickupMode]);
  
  useEffect(() => {
    // Refresh pickup cart periodically when in pickup mode
    if (isPickupMode) {
      const interval = setInterval(loadPickupCart, 1000);
      return () => clearInterval(interval);
    }
  }, [isPickupMode]);

  const fetchWishlist = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("wishlist_items")
        .select("product_id")
        .eq("user_id", session.user.id);

      if (data) {
        setWishlistItems(new Set(data.map(item => item.product_id)));
      }
    } catch (error) {
      console.error("Error fetching wishlist:", error);
    }
  };

  const loadPickupCart = () => {
    const pickupCart = getPickupCart();
    setPickupCartItems(new Set(pickupCart.map(item => item.product.id)));
  };

  const handleAddToPickupCart = async (product: Product) => {
    try {
      // If seller_id is missing, fetch it from the product
      let sellerId = product.seller_id;
      if (!sellerId) {
        // Fetch product details to get seller_id
        const { data } = await supabase
          .from("products")
          .select("seller_id")
          .eq("id", product.id)
          .single();
        sellerId = data?.seller_id || '';
      }
      
      // Map Product to PickupCartItem product format
      const pickupProduct = {
        id: product.id,
        name: product.name,
        description: product.description || null,
        price: product.price,
        stock_quantity: product.stock_quantity,
        image_url: product.image_url || null,
        is_available: product.is_available,
        seller_id: sellerId,
        seller_name: product.seller_name,
        seller_address: product.seller_address,
      };
      
      addToPickupCart(pickupProduct, 1);
      loadPickupCart();
      toast.success("Added to pickup cart!");
    } catch (error: any) {
      toast.error(error.message || "Failed to add to pickup cart");
    }
  };

  const fetchProducts = async () => {
    try {
      // Use location-based RPC if user location is available to show distances
      if (userLocation) {
        const { data, error } = await supabase.rpc('get_products_with_distance', {
          user_lat: userLocation.lat,
          user_lng: userLocation.lng,
          max_distance: maxDistance,
          search_text: searchQuery || null,
          min_price: priceRange?.[0] || null,
          max_price: priceRange?.[1] || null,
          min_stock: minStock || 0,
          in_stock_only: inStockOnly || false
        });

        if (error) throw error;
        
        // Apply client-side sorting
        let sortedData = data || [];
        if (sortBy === "price-asc") {
          sortedData = [...sortedData].sort((a, b) => a.price - b.price);
        } else if (sortBy === "price-desc") {
          sortedData = [...sortedData].sort((a, b) => b.price - a.price);
        } else if (sortBy === "distance-asc") {
          sortedData = [...sortedData].sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));
        }

        // Apply seller filter client-side if needed
        if (sellerId) {
          sortedData = sortedData.filter(p => p.seller_id === sellerId);
        }

        // Apply category filter client-side if needed
        if (categoryId) {
          sortedData = sortedData.filter(p => p.category_id === categoryId);
        }

        // Move out-of-stock items to bottom
        sortedData = [...sortedData].sort((a, b) => {
          if (a.stock_quantity === 0 && b.stock_quantity > 0) return 1;
          if (a.stock_quantity > 0 && b.stock_quantity === 0) return -1;
          return 0;
        });
        
        setProducts(sortedData);
      } else {
        // Fall back to regular query when no location
        let query = supabase
          .from("products")
          .select("*")
          .eq("is_available", true);

        if (searchQuery) {
          query = query.ilike("name", `%${searchQuery}%`);
        }

        if (priceRange) {
          query = query.gte("price", priceRange[0]).lte("price", priceRange[1]);
        }

        if (minStock !== undefined && minStock > 0) {
          query = query.gte("stock_quantity", minStock);
        }

        if (inStockOnly) {
          query = query.gt("stock_quantity", 0);
        }

        if (sellerId) {
          query = query.eq("seller_id", sellerId);
        }

        if (categoryId) {
          query = query.eq("category_id", categoryId);
        }

        // Apply sorting
        if (sortBy === "price-asc") {
          query = query.order("price", { ascending: true });
        } else if (sortBy === "price-desc") {
          query = query.order("price", { ascending: false });
        }

        const { data, error } = await query;

        if (error) throw error;
        
        // Move out-of-stock items to bottom
        const sortedData = (data || []).sort((a, b) => {
          if (a.stock_quantity === 0 && b.stock_quantity > 0) return 1;
          if (a.stock_quantity > 0 && b.stock_quantity === 0) return -1;
          return 0;
        });
        
        setProducts(sortedData);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (productId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Please sign in to add items to cart");
        return;
      }

      // Check if item already in cart
      const { data: existing } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("user_id", session.user.id)
        .eq("product_id", productId)
        .single();

      if (existing) {
        // Update quantity
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + 1 })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new cart item
        const { error } = await supabase
          .from("cart_items")
          .insert({ user_id: session.user.id, product_id: productId, quantity: 1 });

        if (error) throw error;
      }

      toast.success("Added to cart!");
    } catch (error: any) {
      toast.error("Failed to add to cart");
    }
  };

  const handleAddToWishlist = async (productId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Please sign in to add items to wishlist");
        return;
      }

      const isInWishlist = wishlistItems.has(productId);

      if (isInWishlist) {
        // Remove from wishlist
        const { error } = await supabase
          .from("wishlist_items")
          .delete()
          .eq("user_id", session.user.id)
          .eq("product_id", productId);

        if (error) throw error;

        setWishlistItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
        toast.success("Removed from wishlist!");
      } else {
        // Add to wishlist
        const { error } = await supabase
          .from("wishlist_items")
          .insert({ user_id: session.user.id, product_id: productId });

        if (error) throw error;

        setWishlistItems(prev => new Set(prev).add(productId));
        toast.success("Added to wishlist!");
      }
    } catch (error: any) {
      if (error.code !== "PGRST116") {
        toast.error("Failed to update wishlist");
      }
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <div className="h-48 bg-muted rounded-t-lg" />
            <CardHeader className="space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">
          {searchQuery ? "No products found matching your search." : "No products available at the moment."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <Card 
          key={product.id} 
          className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer border border-gray-200 hover:border-primary bg-white"
          onClick={() => navigate(`/product/${product.id}`)}
        >
          <div className="relative h-48 bg-muted">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                No Image
              </div>
            )}
            <Button
              size="icon"
              variant="secondary"
              className={`absolute top-2 right-2 rounded-full ${
                wishlistItems.has(product.id) ? 'bg-red-500 hover:bg-red-600' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                handleAddToWishlist(product.id);
              }}
            >
              <Heart 
                className="h-4 w-4" 
                fill={wishlistItems.has(product.id) ? "white" : "none"}
                color={wishlistItems.has(product.id) ? "white" : "currentColor"}
              />
            </Button>
          </div>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-lg line-clamp-1">{product.name}</CardTitle>
              {product.stock_quantity > 0 ? (
                <Badge variant="secondary" className="bg-secondary/20 text-secondary">
                  In Stock
                </Badge>
              ) : (
                <Badge variant="destructive">Out of Stock</Badge>
              )}
            </div>
            <CardDescription className="line-clamp-2">
              {product.description || "No description available"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              ₹{product.price.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {product.stock_quantity} units available
            </p>
            {product.distance_km !== undefined && (
              <div className="mt-2 flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={product.distance_km < 5 ? "bg-primary/10 text-primary border-primary" : ""}
                >
                  📍 {product.distance_km.toFixed(1)} km away
                </Badge>
              </div>
            )}
            {product.seller_name && (
              <p className="text-xs text-muted-foreground mt-2">
                Seller: {product.seller_name}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            {isPickupMode ? (
              <>
                {pickupCartItems.has(product.id) ? (
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/offline-pickup');
                    }}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    View in Pickup Cart
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToPickupCart(product);
                    }}
                    disabled={product.stock_quantity === 0}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Add to Pickup Cart
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddToCart(product.id);
                  }}
                  disabled={product.stock_quantity === 0}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add to Regular Cart
                </Button>
              </>
            ) : (
              <Button
                className="w-full bg-primary hover:bg-primary/90 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddToCart(product.id);
                }}
                disabled={product.stock_quantity === 0}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add to Cart
              </Button>
            )}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};

export default ProductGrid;
