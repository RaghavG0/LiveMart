import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Heart, ShoppingCart, Trash2 } from "lucide-react";
import { User } from "@supabase/supabase-js";

interface WishlistItem {
  id: string;
  product: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    description: string | null;
    is_available: boolean;
  };
}

const Wishlist = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        fetchWishlistItems(session.user.id);
      }
    });
  }, [navigate]);

  const fetchWishlistItems = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("wishlist_items")
        .select(`
          id,
          product:products (
            id,
            name,
            price,
            image_url,
            description,
            is_available
          )
        `)
        .eq("user_id", userId);

      if (error) throw error;
      setWishlistItems(data as unknown as WishlistItem[]);
    } catch (error: any) {
      toast.error("Failed to load wishlist");
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("wishlist_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      setWishlistItems((prev) => prev.filter((item) => item.id !== itemId));
      toast.success("Removed from wishlist");
    } catch (error: any) {
      toast.error("Failed to remove item");
    }
  };

  const addToCart = async (productId: string) => {
    if (!user) return;

    try {
      // Check if item already in cart
      const { data: existing } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("user_id", user.id)
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
          .insert({ user_id: user.id, product_id: productId, quantity: 1 });

        if (error) throw error;
      }

      toast.success("Added to cart");
    } catch (error: any) {
      toast.error("Failed to add to cart");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading wishlist...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Shopping
        </Button>

        <h1 className="text-4xl font-bold mb-8 bg-gradient-primary bg-clip-text text-transparent">
          My Wishlist
        </h1>

        {wishlistItems.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-2xl font-semibold mb-2">Your wishlist is empty</h2>
              <p className="text-muted-foreground mb-6">
                Save items you love for later!
              </p>
              <Button onClick={() => navigate("/")}>
                Start Shopping
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {wishlistItems.map((item) => (
              <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative">
                  <img
                    src={item.product.image_url || "/placeholder.svg"}
                    alt={item.product.name}
                    className="w-full h-48 object-cover"
                  />
                  {!item.product.is_available && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white font-semibold">Out of Stock</span>
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                    {item.product.name}
                  </h3>
                  {item.product.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {item.product.description}
                    </p>
                  )}
                  <p className="text-2xl font-bold text-primary mb-4">
                    ₹{item.product.price}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => addToCart(item.product.id)}
                      disabled={!item.product.is_available}
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Add to Cart
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => removeFromWishlist(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Wishlist;
