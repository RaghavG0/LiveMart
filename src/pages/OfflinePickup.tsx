import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Store, CalendarIcon, Clock, ShoppingCart, Plus, Minus, X, CheckCircle2, Package, MapPin } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  image_url: string | null;
  is_available: boolean;
  seller_id: string;
  seller_name?: string;
  seller_address?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

const timeSlots = [
  "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"
];

const OfflinePickup = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
    fetchProducts();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in to use store pickup");
      navigate("/auth");
      return;
    }
    setUser(session.user);
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          profiles:seller_id (
            full_name,
            location_address
          )
        `)
        .eq("is_available", true)
        .gt("stock_quantity", 0)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const productsWithSeller = (data || []).map((product: any) => ({
        ...product,
        seller_name: product.profiles?.full_name || "Unknown Seller",
        seller_address: product.profiles?.location_address || "",
      }));

      setProducts(productsWithSeller);
    } catch (error: any) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.stock_quantity) {
        toast.error("Cannot add more. Stock limit reached.");
        return;
      }
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
    toast.success("Added to cart");
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
    toast.success("Removed from cart");
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQuantity = item.quantity + delta;
        if (newQuantity <= 0) {
          return item; // Don't remove, just don't update
        }
        if (newQuantity > item.product.stock_quantity) {
          toast.error("Cannot add more. Stock limit reached.");
          return item;
        }
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    if (!selectedDate || !selectedTime) {
      toast.error("Please select a pickup date and time");
      return;
    }

    setSubmitting(true);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to place an order");
        navigate("/auth");
        return;
      }

      // Call edge function to create offline pickup order
      const { data, error } = await supabase.functions.invoke("create-offline-pickup-order", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          items: cart.map(item => ({
            product_id: item.product.id,
            quantity: item.quantity,
            price_at_purchase: item.product.price,
          })),
          pickup_date: selectedDate.toISOString().split('T')[0],
          pickup_time: selectedTime,
          total_amount: totalAmount,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Order placed successfully! Check your email for confirmation and reminder.");
        setCart([]);
        setSelectedDate(undefined);
        setSelectedTime("");
        navigate("/orders");
      } else {
        throw new Error(data?.error || "Failed to create order");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error(error.message || "Failed to place order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-hero shadow-lg border-b border-primary-dark/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="text-white hover:text-primary hover:bg-white/10"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Store className="h-6 w-6 text-white" />
                <h1 className="text-xl md:text-2xl font-bold text-white">Store Pickup</h1>
              </div>
            </div>
            {cart.length > 0 && (
              <Badge variant="secondary" className="text-lg px-4 py-2">
                {cart.length} item{cart.length > 1 ? 's' : ''} • ₹{totalAmount.toFixed(2)}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product Selection */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Select Products for Pickup</CardTitle>
                <CardDescription>Choose items you want to pick up from the store</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => (
                      <Card key={i} className="animate-pulse">
                        <CardContent className="p-4">
                          <div className="h-32 bg-muted rounded mb-2"></div>
                          <div className="h-4 bg-muted rounded mb-2"></div>
                          <div className="h-4 bg-muted rounded w-2/3"></div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No products found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredProducts.map((product) => {
                      const cartItem = cart.find(item => item.product.id === product.id);
                      return (
                        <Card key={product.id} className="overflow-hidden">
                          {product.image_url && (
                            <div className="aspect-video w-full overflow-hidden bg-muted">
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <CardContent className="p-4">
                            <h3 className="font-semibold mb-1">{product.name}</h3>
                            {product.description && (
                              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                {product.description}
                              </p>
                            )}
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-lg font-bold text-primary">
                                ₹{product.price.toFixed(2)}
                              </span>
                              <Badge variant="outline">
                                Stock: {product.stock_quantity}
                              </Badge>
                            </div>
                            {cartItem ? (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateQuantity(product.id, -1)}
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <span className="font-semibold w-8 text-center">
                                    {cartItem.quantity}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateQuantity(product.id, 1)}
                                    disabled={cartItem.quantity >= product.stock_quantity}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => removeFromCart(product.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                className="w-full"
                                onClick={() => addToCart(product)}
                                disabled={product.stock_quantity === 0}
                              >
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                Add to Cart
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Checkout Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Pickup Details</CardTitle>
                <CardDescription>Schedule your pickup time</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Cart Summary */}
                {cart.length > 0 && (
                  <>
                    <div>
                      <h4 className="font-semibold mb-3">Order Summary</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {cart.map((item) => (
                          <div key={item.product.id} className="flex items-center justify-between text-sm">
                            <div className="flex-1">
                              <p className="font-medium">{item.product.name}</p>
                              <p className="text-muted-foreground">
                                {item.quantity} × ₹{item.product.price.toFixed(2)}
                              </p>
                            </div>
                            <p className="font-semibold">
                              ₹{(item.quantity * item.product.price).toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                      <Separator className="my-4" />
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span className="text-primary">₹{totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Date Picker */}
                <div>
                  <Label className="flex items-center gap-2 mb-3">
                    <CalendarIcon className="w-4 h-4" />
                    Select Pickup Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => date < new Date() || date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Time Slots */}
                <div>
                  <Label className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4" />
                    Select Time Slot
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {timeSlots.map((slot) => (
                      <Button
                        key={slot}
                        variant={selectedTime === slot ? "default" : "outline"}
                        onClick={() => setSelectedTime(slot)}
                        className="w-full"
                      >
                        {slot}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                {selectedDate && selectedTime && cart.length > 0 && (
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-semibold">Pickup Scheduled</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Date: {format(selectedDate, "PPP")}
                    </p>
                    <p className="text-sm text-muted-foreground">Time: {selectedTime}</p>
                  </div>
                )}

                {/* Checkout Button */}
                <Button
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || !selectedDate || !selectedTime || submitting}
                  className="w-full"
                  size="lg"
                >
                  {submitting ? "Processing..." : "Confirm Pickup Order"}
                </Button>

                {cart.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Add products to your cart to continue
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OfflinePickup;
