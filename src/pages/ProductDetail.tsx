import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Heart, ArrowLeft } from "lucide-react";
import FeedbackList from "@/components/feedback/FeedbackList";
import FeedbackForm from "@/components/feedback/FeedbackForm";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  image_url: string | null;
  category_id: string | null;
  seller_name?: string;
  seller_address?: string;
}

interface DeliveredOrder {
  orderId: string;
  hasReview: boolean;
  existingReview?: {
    rating: number;
    comment: string | null;
  };
}

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveredOrder, setDeliveredOrder] = useState<DeliveredOrder | null>(null);
  const [refreshFeedback, setRefreshFeedback] = useState(0);
  const [existingReview, setExistingReview] = useState<{
    rating: number;
    comment: string | null;
  } | null>(null);
  const [userSession, setUserSession] = useState<any>(null);

  useEffect(() => {
    if (id) {
      fetchProductDetails();
      checkDeliveredOrder();
      checkExistingReview();
    }
  }, [id]);

  useEffect(() => {
    // Get user session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserSession(session);
    });
  }, []);

  const checkExistingReview = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !id) return;

      const { data } = await supabase
        .from("reviews")
        .select("rating, comment")
        .eq("user_id", session.user.id)
        .eq("product_id", id)
        .maybeSingle();

      if (data) {
        setExistingReview(data);
      }
    } catch (error) {
      console.error("Error checking existing review:", error);
    }
  };

  const checkDeliveredOrder = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Check if user has a delivered order containing this product
      const { data: orders, error } = await supabase
        .from("orders")
        .select(`
          id,
          status,
          order_items!inner(
            product_id
          ),
          reviews(
            rating,
            comment
          )
        `)
        .eq("customer_id", session.user.id)
        .eq("status", "delivered")
        .eq("order_items.product_id", id);

      if (error) throw error;

      if (orders && orders.length > 0) {
        const order = orders[0];
        // Check if review already exists for this product
        const { data: existingReview } = await supabase
          .from("reviews")
          .select("rating, comment")
          .eq("user_id", session.user.id)
          .eq("product_id", id)
          .eq("order_id", order.id)
          .maybeSingle();

        setDeliveredOrder({
          orderId: order.id,
          hasReview: !!existingReview,
          existingReview: existingReview || undefined,
        });
      }
    } catch (error) {
      console.error("Error checking delivered order:", error);
    }
  };

  const fetchProductDetails = async () => {
    try {
      setLoading(true);

      // Fetch product details
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (productError) throw productError;

      // Fetch seller info
      const { data: sellerData } = await supabase
        .from("profiles")
        .select("full_name, location_address")
        .eq("id", productData.seller_id)
        .single();

      const formattedProduct = {
        ...productData,
        seller_name: sellerData?.full_name,
        seller_address: sellerData?.location_address,
      };

      setProduct(formattedProduct);

      // Fetch similar products from the same category
      if (productData.category_id) {
        const { data: similarData, error: similarError } = await supabase
          .from("products")
          .select("*")
          .eq("category_id", productData.category_id)
          .neq("id", id)
          .eq("is_available", true)
          .limit(4);

        if (similarError) throw similarError;
        setSimilarProducts(similarData || []);
      }
    } catch (error: any) {
      console.error("Error fetching product:", error);
      toast({
        title: "Error",
        description: "Failed to load product details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (productId: string, productName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please sign in to add items to cart",
          variant: "destructive",
        });
        return;
      }

      const { data: existingItem } = await supabase
        .from("cart_items")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("product_id", productId)
        .single();

      if (existingItem) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existingItem.quantity + 1 })
          .eq("id", existingItem.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cart_items")
          .insert({
            user_id: session.user.id,
            product_id: productId,
            quantity: 1,
          });

        if (error) throw error;
      }

      toast({
        title: "Added to cart",
        description: `${productName} has been added to your cart`,
      });
    } catch (error: any) {
      console.error("Error adding to cart:", error);
      toast({
        title: "Error",
        description: "Failed to add item to cart",
        variant: "destructive",
      });
    }
  };

  const handleAddToWishlist = async (productId: string, productName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please sign in to add items to wishlist",
          variant: "destructive",
        });
        return;
      }

      const { data: existing } = await supabase
        .from("wishlist_items")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("product_id", productId)
        .single();

      if (existing) {
        toast({
          title: "Already in wishlist",
          description: `${productName} is already in your wishlist`,
        });
        return;
      }

      const { error } = await supabase
        .from("wishlist_items")
        .insert({
          user_id: session.user.id,
          product_id: productId,
        });

      if (error) throw error;

      toast({
        title: "Added to wishlist",
        description: `${productName} has been added to your wishlist`,
      });
    } catch (error: any) {
      console.error("Error adding to wishlist:", error);
      toast({
        title: "Error",
        description: "Failed to add item to wishlist",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="animate-pulse space-y-4">
            <div className="h-96 bg-muted rounded-lg"></div>
            <div className="h-8 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Product not found</h2>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="aspect-square rounded-lg overflow-hidden bg-muted">
            <img
              src={product.image_url || "/placeholder.svg"}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">{product.name}</h1>
              {product.seller_name && (
                <p className="text-muted-foreground">
                  Sold by: {product.seller_name}
                  {product.seller_address && ` • ${product.seller_address}`}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold text-primary">
                ₹{product.price.toFixed(2)}
              </span>
              {product.stock_quantity > 0 ? (
                <Badge variant="default">In Stock ({product.stock_quantity})</Badge>
              ) : (
                <Badge variant="destructive">Out of Stock</Badge>
              )}
            </div>

            {product.description && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground">{product.description}</p>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <Button
                onClick={() => handleAddToCart(product.id, product.name)}
                disabled={product.stock_quantity === 0}
                className="flex-1"
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Add to Cart
              </Button>
              <Button
                variant="outline"
                onClick={() => handleAddToWishlist(product.id, product.name)}
              >
                <Heart className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Feedback Section */}
        <div className="mb-12 space-y-8">
          <h2 className="text-2xl font-bold">Customer Reviews</h2>
          
          {/* Show feedback form for all authenticated users (open review policy) */}
          {userSession && (
            <FeedbackForm
              productId={product.id}
              productName={product.name}
              orderId={deliveredOrder?.orderId} // Optional - for verified buyer badge
              existingReview={existingReview || deliveredOrder?.existingReview || undefined}
              onSuccess={async () => {
                // Refresh existing review check first
                await checkExistingReview();
                // Wait a moment for database transaction to commit
                await new Promise(resolve => setTimeout(resolve, 500));
                // Trigger refresh with incremented value
                setRefreshFeedback((prev) => prev + 1);
                // Also refresh after a longer delay as fallback to ensure data is saved
                setTimeout(() => {
                  setRefreshFeedback((prev) => prev + 1);
                }, 2000);
              }}
            />
          )}
          
          <FeedbackList 
            key={`${product.id}-${refreshFeedback}`} 
            productId={product.id} 
            refreshTrigger={refreshFeedback}
          />
        </div>

        {similarProducts.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Similar Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {similarProducts.map((similarProduct) => (
                <Card
                  key={similarProduct.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/product/${similarProduct.id}`)}
                >
                  <CardHeader className="p-0">
                    <div className="aspect-square overflow-hidden rounded-t-lg">
                      <img
                        src={similarProduct.image_url || "/placeholder.svg"}
                        alt={similarProduct.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <CardTitle className="text-lg mb-2">{similarProduct.name}</CardTitle>
                    <CardDescription className="text-xl font-bold text-primary">
                      ₹{similarProduct.price.toFixed(2)}
                    </CardDescription>
                  </CardContent>
                  <CardFooter className="p-4 pt-0">
                    {similarProduct.stock_quantity > 0 ? (
                      <Badge variant="default">In Stock</Badge>
                    ) : (
                      <Badge variant="destructive">Out of Stock</Badge>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
