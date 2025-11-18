import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Heart } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
  image_url: string;
  is_available: boolean;
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
}

const ProductGrid = ({ searchQuery, priceRange, minStock, inStockOnly, sortBy, userLocation, maxDistance }: ProductGridProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, [searchQuery, priceRange, minStock, inStockOnly, sortBy, userLocation, maxDistance]);

  const fetchProducts = async () => {
    try {
      // Use location-based RPC if user location and distance filter are available
      if (userLocation && (sortBy === "distance-asc" || maxDistance)) {
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
        
        // Apply client-side sorting if needed (RPC already sorts by distance)
        let sortedData = data || [];
        if (sortBy === "price-asc") {
          sortedData = [...sortedData].sort((a, b) => a.price - b.price);
        } else if (sortBy === "price-desc") {
          sortedData = [...sortedData].sort((a, b) => b.price - a.price);
        }
        
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

        // Apply sorting
        if (sortBy === "price-asc") {
          query = query.order("price", { ascending: true });
        } else if (sortBy === "price-desc") {
          query = query.order("price", { ascending: false });
        }

        const { data, error } = await query;

        if (error) throw error;
        setProducts(data || []);
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

      // Check if item already in wishlist
      const { data: existing } = await supabase
        .from("wishlist_items")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("product_id", productId)
        .single();

      if (existing) {
        toast.info("Already in your wishlist");
        return;
      }

      // Insert new wishlist item
      const { error } = await supabase
        .from("wishlist_items")
        .insert({ user_id: session.user.id, product_id: productId });

      if (error) throw error;

      toast.success("Added to wishlist!");
    } catch (error: any) {
      if (error.code !== "PGRST116") { // Ignore "no rows returned" error
        toast.error("Failed to add to wishlist");
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
        <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
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
              className="absolute top-2 right-2 rounded-full"
              onClick={() => handleAddToWishlist(product.id)}
            >
              <Heart className="h-4 w-4" />
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
              ${product.price.toFixed(2)}
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
          <CardFooter>
            <Button
              className="w-full"
              onClick={() => handleAddToCart(product.id)}
              disabled={product.stock_quantity === 0}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Add to Cart
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};

export default ProductGrid;
