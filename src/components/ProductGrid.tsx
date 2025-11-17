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
}

interface ProductGridProps {
  searchQuery: string;
}

const ProductGrid = ({ searchQuery }: ProductGridProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, [searchQuery]);

  const fetchProducts = async () => {
    try {
      let query = supabase
        .from("products")
        .select("*")
        .eq("is_available", true);

      if (searchQuery) {
        query = query.ilike("name", `%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (productId: string) => {
    toast.success("Added to cart!");
  };

  const handleAddToWishlist = async (productId: string) => {
    toast.success("Added to wishlist!");
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
