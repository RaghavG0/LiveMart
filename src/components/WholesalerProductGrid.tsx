import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Store, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface WholesalerProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
  image_url: string;
  is_available: boolean;
  seller_id: string;
  profiles: {
    full_name: string;
    location_address: string;
  };
}

interface CartItem {
  product: WholesalerProduct;
  quantity: number;
}

const WholesalerProductGrid = () => {
  const [products, setProducts] = useState<WholesalerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchWholesalerProducts();
  }, [searchQuery]);

  const fetchWholesalerProducts = async () => {
    try {
      // Use RPC to fetch wholesaler products with proper security
      const { data, error } = await supabase
        .rpc('list_wholesaler_products', { _search: searchQuery || null });

      if (error) throw error;

      // Fetch profiles for the products
      if (data && data.length > 0) {
        const sellerIds = [...new Set(data.map((p: any) => p.seller_id))];
        
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, location_address")
          .in("id", sellerIds);

        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
        }

        // Map profiles to products
        const productsWithProfiles = data.map((product: any) => ({
          ...product,
          profiles: profiles?.find((p) => p.id === product.seller_id) || {
            full_name: "Unknown Seller",
            location_address: null
          }
        }));

        setProducts(productsWithProfiles);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error("Error fetching wholesaler products:", error);
      toast.error("Failed to load wholesaler products");
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: WholesalerProduct, quantity: number) => {
    setCart((prev) => {
      const existingItem = prev.find((item) => item.product.id === product.id);
      if (existingItem) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    toast.success(`Added ${quantity} units to cart`);
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    setShowCart(false);
    setShowCheckout(true);
  };

  const placeOrder = async () => {
    if (!deliveryAddress.trim()) {
      toast.error("Please enter a delivery address");
      return;
    }

    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to place orders");
        return;
      }

      // Group cart items by seller
      const ordersBySeller = cart.reduce((acc, item) => {
        const sellerId = item.product.seller_id;
        if (!acc[sellerId]) {
          acc[sellerId] = [];
        }
        acc[sellerId].push(item);
        return acc;
      }, {} as Record<string, CartItem[]>);

      // Create separate orders for each wholesaler
      for (const [sellerId, items] of Object.entries(ordersBySeller)) {
        const totalAmount = items.reduce(
          (sum, item) => sum + item.product.price * item.quantity,
          0
        );

        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            customer_id: session.user.id,
            seller_id: sellerId,
            total_amount: totalAmount,
            status: "pending",
            order_type: "retailer",
            delivery_address: deliveryAddress,
            notes: notes || null,
          })
          .select()
          .single();

        if (orderError) throw orderError;

        // Insert order items
        const orderItems = items.map((item) => ({
          order_id: order.id,
          product_id: item.product.id,
          quantity: item.quantity,
          price_at_purchase: item.product.price,
        }));

        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      toast.success("Orders placed successfully!");
      setCart([]);
      setShowCheckout(false);
      setDeliveryAddress("");
      setNotes("");
    } catch (error) {
      console.error("Error placing order:", error);
      toast.error("Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex-1 w-full md:max-w-md">
          <Input
            placeholder="Search wholesaler products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {cart.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCart(true)}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              View Cart ({cart.length})
            </Button>
            <Button onClick={handleCheckout}>
              Proceed to Checkout
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onAddToCart={addToCart}
          />
        ))}
      </div>

      {products.length === 0 && !loading && (
        <div className="text-center py-12">
          <Store className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground text-lg">
            No wholesaler products available at the moment.
          </p>
        </div>
      )}

      {/* Cart Dialog */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Shopping Cart</DialogTitle>
            <DialogDescription>
              Review your items before checkout
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {cart.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg"
              >
                {item.product.image_url && (
                  <img
                    src={item.product.image_url}
                    alt={item.product.name}
                    className="w-20 h-20 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <h4 className="font-semibold">{item.product.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    ₹{item.product.price.toFixed(2)} × {item.quantity}
                  </p>
                  <p className="text-sm font-medium mt-1">
                    Subtotal: ₹{(item.product.price * item.quantity).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max={item.product.stock_quantity}
                    value={item.quantity}
                    onChange={(e) =>
                      updateCartQuantity(
                        item.product.id,
                        parseInt(e.target.value) || 1
                      )
                    }
                    className="w-20"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFromCart(item.product.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Total:</span>
              <span>₹{cartTotal.toFixed(2)}</span>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCart(false)}>
                Continue Shopping
              </Button>
              <Button onClick={handleCheckout}>
                Proceed to Checkout
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Complete Your Order</DialogTitle>
            <DialogDescription>
              Enter delivery details to place your wholesaler order
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="delivery-address">Delivery Address *</Label>
                <Textarea
                  id="delivery-address"
                  placeholder="Enter your complete delivery address..."
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={3}
                  required
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any special instructions or notes for the wholesaler..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex justify-between text-sm"
                  >
                    <span>
                      {item.product.name} × {item.quantity}
                    </span>
                    <span>₹{(item.product.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between font-bold text-lg pt-2">
                  <span>Total:</span>
                  <span>₹{cartTotal.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCheckout(false);
                  setShowCart(true);
                }}
              >
                Back to Cart
              </Button>
              <Button onClick={placeOrder} disabled={submitting}>
                {submitting ? "Placing Order..." : "Place Order"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface ProductCardProps {
  product: WholesalerProduct;
  onAddToCart: (product: WholesalerProduct, quantity: number) => void;
}

const ProductCard = ({ product, onAddToCart }: ProductCardProps) => {
  const [quantity, setQuantity] = useState(1);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow border border-gray-200 hover:border-primary bg-white">
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
        <Badge className="absolute top-2 left-2" variant="secondary">
          <Store className="h-3 w-3 mr-1" />
          Wholesaler
        </Badge>
      </div>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-1">{product.name}</CardTitle>
          {product.stock_quantity > 0 ? (
            <Badge variant="secondary">In Stock</Badge>
          ) : (
            <Badge variant="destructive">Out of Stock</Badge>
          )}
        </div>
        <CardDescription className="line-clamp-2">
          {product.description || "No description available"}
        </CardDescription>
        <div className="text-sm text-muted-foreground mt-2">
          <p className="flex items-center gap-1">
            <Store className="h-3 w-3" />
            {product.profiles?.full_name || "Unknown Seller"}
          </p>
          {product.profiles?.location_address && (
            <p className="text-xs">{product.profiles.location_address}</p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-primary">
          ₹{product.price.toFixed(2)}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {product.stock_quantity} units available
        </p>
        <div className="mt-4 space-y-2">
          <Label htmlFor={`qty-${product.id}`}>Quantity</Label>
          <Input
            id={`qty-${product.id}`}
            type="number"
            min="1"
            max={product.stock_quantity}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            disabled={product.stock_quantity === 0}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full bg-primary hover:bg-primary/90 text-white"
          onClick={() => onAddToCart(product, quantity)}
          disabled={product.stock_quantity === 0}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Add to Cart
        </Button>
      </CardFooter>
    </Card>
  );
};

export default WholesalerProductGrid;
