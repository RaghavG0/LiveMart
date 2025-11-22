import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  ShoppingBag, 
  Store, 
  Warehouse, 
  Leaf, 
  Truck, 
  Sparkles, 
  Headphones,
  ArrowRight,
  Menu,
  X,
  Instagram,
  Twitter,
  Facebook
} from "lucide-react";
import { useState } from "react";

const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  
  const features = [
    {
      icon: ShoppingBag,
      title: "For Customers",
      description: "Browse thousands of products, compare prices, and get fast delivery to your doorstep.",
      role: "customer" as const,
    },
    {
      icon: Store,
      title: "For Retailers",
      description: "Manage your inventory, reach more customers, and grow your business online.",
      role: "retailer" as const,
    },
    {
      icon: Warehouse,
      title: "For Wholesalers",
      description: "Connect with retailers, manage bulk orders, and streamline your supply chain.",
      role: "wholesaler" as const,
    },
  ];

  const whyChooseUs = [
    {
      icon: Leaf,
      title: "Farm-to-Table Freshness",
      description: "We partner directly with local farms and trusted suppliers to bring you the freshest produce and highest quality goods, often harvested just hours before delivery.",
    },
    {
      icon: Leaf,
      title: "Sustainable Sourcing",
      description: "Committed to eco-friendly practices, we prioritize sustainable sourcing and minimize waste, ensuring every purchase supports a healthier planet.",
    },
    {
      icon: Truck,
      title: "Lightning-Fast Delivery",
      description: "Enjoy incredibly swift delivery services, getting your order to your doorstep within 30-60 minutes of ordering, so you never have to wait long for what you need.",
    },
    {
      icon: Sparkles,
      title: "Personalized Shopping",
      description: "Our smart recommendations and easy-to-use platform learn your preferences, making your shopping experience intuitive and tailored just for you.",
    },
    {
      icon: Headphones,
      title: "Dedicated Support",
      description: "Experience world-class customer service with a team ready to assist you at every step, ensuring your satisfaction is always our top priority.",
    },
    {
      icon: ShoppingBag,
      title: "Wide Product Selection",
      description: "Browse through thousands of products from fresh produce to pantry essentials, all curated for quality and delivered with care to your doorstep.",
    },
  ];

  // Email validation regex
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Validate email format on client side
  const validateEmail = (email: string): boolean => {
    return EMAIL_REGEX.test(email.trim());
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    if (!email || !email.trim()) {
      toast.error("Error: Please enter a valid email address.");
      return;
    }

    const trimmedEmail = email.trim();
    
    if (!validateEmail(trimmedEmail)) {
      toast.error("Error: Please enter a valid email address.");
      return;
    }

    try {
      // Call Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('subscribe-email', {
        body: { email: trimmedEmail }
      });

      if (error) {
        console.error('Subscription error:', error);
        toast.error(error.message || "Subscription failed. Please try again later.");
        return;
      }

      // Handle response
      if (data) {
        if (data.already_subscribed) {
          toast.success("You are already subscribed!");
        } else if (data.message) {
          toast.success("Success! You are now subscribed to LiveMart alerts.");
        } else {
          toast.success("Success! You are now subscribed to LiveMart alerts.");
        }
        // Clear input field on success
        setEmail("");
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast.error(error.message || "Subscription failed. Please try again later.");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-hero shadow-lg border-b border-primary-dark/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Left Side - Logo */}
            <Link to="/" className="flex items-center space-x-2 group">
              <div className="relative">
                <ShoppingBag className="h-8 w-8 md:h-10 md:w-10 text-primary transition-transform group-hover:scale-110" />
                <div className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full animate-pulse" />
              </div>
              <span className="text-xl md:text-2xl font-bold text-white">
                Live<span className="text-primary">Mart</span>
              </span>
            </Link>

            {/* Middle - Navigation Links (Desktop) */}
            <div className="hidden md:flex items-center space-x-8">
              <a 
                href="#home" 
                className="text-white hover:text-primary transition-colors font-medium"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('home')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Home
              </a>
              <a 
                href="#products" 
                className="text-white hover:text-primary transition-colors font-medium"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Products
              </a>
              <a 
                href="#features" 
                className="text-white hover:text-primary transition-colors font-medium"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Features
              </a>
            </div>

            {/* Right Side - Auth Buttons (Desktop) */}
            <div className="hidden md:flex items-center space-x-4">
              <Link to="/auth">
                <Button variant="ghost" className="text-white hover:text-primary hover:bg-white/10">
                  Login
                </Button>
              </Link>
              <Link to="/auth">
                <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/50">
                  Sign Up
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-white hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

            {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-4 space-y-3 border-t border-primary-dark/30 pt-4">
              <a
                href="#home"
                className="block text-white hover:text-primary transition-colors py-2"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  document.getElementById('home')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Home
              </a>
              <a
                href="#products"
                className="block text-white hover:text-primary transition-colors py-2"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Products
              </a>
              <a
                href="#features"
                className="block text-white hover:text-primary transition-colors py-2"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Features
              </a>
              <div className="flex flex-col space-y-2 pt-2">
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full text-white hover:text-primary hover:bg-white/10">
                    Login
                  </Button>
                </Link>
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-primary hover:bg-primary/90 text-white">
                    Sign Up
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="pt-32 md:pt-40 min-h-screen flex items-center bg-gradient-hero relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-32 h-32 border-2 border-primary rounded-full" />
          <div className="absolute top-40 right-20 w-24 h-24 border-2 border-primary rounded-full" />
          <div className="absolute bottom-20 left-1/4 w-20 h-20 border-2 border-primary rounded-full" />
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Text Content */}
            <div className="text-center lg:text-left space-y-6">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                Your Fresh Market,
                <br />
                <span className="text-primary-light">Delivered to Your Door</span>
              </h1>
              <p className="text-lg md:text-xl text-white/90 max-w-2xl lg:max-w-none">
                Experience the convenience of high-quality, sustainably sourced groceries and local produce, brought directly to you with speed and care.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link to="/auth">
                  <Button 
                    size="lg" 
                    className="bg-primary hover:bg-primary-light text-white text-lg px-8 py-6 shadow-lg shadow-primary/50 hover:shadow-xl hover:shadow-primary/60 transition-all"
                  >
                    Shop Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="border-2 border-white/80 bg-transparent text-white hover:bg-white hover:text-primary-dark hover:border-white text-lg px-8 py-6 shadow-lg"
                >
                  Learn More
                </Button>
              </div>
            </div>

            {/* Right Side - Image/Visual */}
            <div className="hidden lg:block relative">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl transform scale-150" />
                <div className="relative bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      <ShoppingBag className="h-48 w-48 text-white/90" strokeWidth={1.5} />
                      <div className="absolute -top-4 -right-4 bg-primary rounded-full p-4 animate-bounce">
                        <Leaf className="h-8 w-8 text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Built for Everyone: Tailored Shopping Experiences
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Whether you're shopping for yourself, managing a retail business, or running a wholesale operation, we have the perfect solution for you.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="border-2 border-gray-200 hover:border-primary transition-all shadow-md hover:shadow-xl cursor-pointer group bg-white"
                onClick={() => navigate(`/auth?role=${feature.role}`)}
              >
                <CardHeader className="text-center space-y-4 pb-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="text-xl font-bold">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <CardDescription className="text-base text-gray-600">
                    {feature.description}
                  </CardDescription>
                  <Button
                    variant="link"
                    className="text-primary hover:text-primary-dark p-0 h-auto group-hover:underline"
                  >
                    Get Started <ArrowRight className="ml-1 h-4 w-4 inline" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <Link to="/auth">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary-light text-white px-8 py-6 text-lg shadow-lg shadow-primary/50"
              >
                Explore Our Products
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Why Choose LiveMart? Unmatched Quality and Convenience
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Discover what makes us the preferred choice for fresh groceries and exceptional service.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {whyChooseUs.map((feature, index) => (
              <Card
                key={index}
                className="border border-gray-200 hover:border-primary transition-all shadow-md hover:shadow-lg bg-white group"
              >
                <CardHeader className="space-y-4">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-xl font-bold">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base text-gray-600 leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-hero text-white py-16 border-t border-primary-dark/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            {/* Left Side - Subscription */}
            <div className="space-y-4">
              <h3 className="text-2xl font-bold">
                Stay in the Loop with <span className="text-primary">LiveMart</span>
              </h3>
              <p className="text-white/80 leading-relaxed">
                Get exclusive offers, new product alerts, and fresh recipes delivered weekly. No spam, just good food vibes!
              </p>
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-gray-300 focus:border-primary focus:ring-primary"
                  required
                  aria-label="Email address for subscription"
                  aria-required="true"
                />
                <Button
                  type="submit"
                  className="bg-gradient-subscribe hover:opacity-90 text-white shadow-lg whitespace-nowrap"
                  aria-label="Subscribe to LiveMart newsletter"
                >
                  Subscribe
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </div>

            {/* Middle - Social Media */}
            <div className="flex flex-col items-center justify-center space-y-4">
              <h4 className="text-xl font-semibold mb-2">Connect With Us</h4>
              <div className="flex space-x-4">
                <a
                  href="#"
                  className="w-12 h-12 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-primary transition-colors flex items-center justify-center border border-white/20 hover:border-primary"
                  aria-label="Instagram"
                >
                  <Instagram className="h-5 w-5" />
                </a>
                <a
                  href="#"
                  className="w-12 h-12 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-primary transition-colors flex items-center justify-center border border-white/20 hover:border-primary"
                  aria-label="Twitter"
                >
                  <Twitter className="h-5 w-5" />
                </a>
                <a
                  href="#"
                  className="w-12 h-12 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-primary transition-colors flex items-center justify-center border border-white/20 hover:border-primary"
                  aria-label="Facebook"
                >
                  <Facebook className="h-5 w-5" />
                </a>
              </div>
            </div>

            {/* Right Side - Company Info */}
            <div className="flex flex-col items-center md:items-end justify-center space-y-4 text-center md:text-right">
              <div className="flex items-center space-x-2 mb-4">
                <ShoppingBag className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold">
                  Live<span className="text-primary">Mart</span>
                </span>
              </div>
              <p className="text-white/80 leading-relaxed max-w-xs">
                LiveMart: Freshness, Delivered. Built with love for healthy living.
              </p>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-white/20 pt-8 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-white/70 text-sm">
              © 2024 LiveMart. All rights reserved.
            </p>
            <p className="text-white/70 text-sm">
              Made with <span className="text-primary">💚</span> for local communities.
            </p>
              </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;