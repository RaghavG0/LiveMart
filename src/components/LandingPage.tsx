import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingBag, Store, Warehouse, TrendingUp, Shield, Clock } from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();
  
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

  const benefits = [
    {
      icon: TrendingUp,
      title: "Boost Your Sales",
      description: "Reach customers across your region with our powerful platform",
    },
    {
      icon: Shield,
      title: "Secure Payments",
      description: "Industry-standard security for all transactions",
    },
    {
      icon: Clock,
      title: "Real-time Updates",
      description: "Track orders and inventory in real-time",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-hero bg-clip-text text-transparent">
            Welcome to Live MART
          </h1>
          <p className="text-xl text-muted-foreground">
            Connecting Customers, Retailers, and Wholesalers in one seamless platform
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/auth">
              <Button size="lg" className="shadow-primary">
                Get Started
              </Button>
            </Link>
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Built for Everyone</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="border-2 hover:border-primary transition-all shadow-md hover:shadow-lg cursor-pointer"
              onClick={() => navigate(`/auth?role=${feature.role}`)}
            >
              <CardHeader>
                <feature.icon className="h-12 w-12 text-primary mb-4" />
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">{feature.description}</CardDescription>
                <Button variant="link" className="p-0 h-auto mt-4">
                  Get Started →
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose Live MART?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                  <benefit.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">{benefit.title}</h3>
                <p className="text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="bg-gradient-primary text-primary-foreground shadow-xl">
          <CardContent className="p-12 text-center space-y-6">
            <h2 className="text-4xl font-bold">Ready to Transform Your Business?</h2>
            <p className="text-xl opacity-90">
              Join thousands of businesses already thriving on Live MART
            </p>
            <Link to="/auth">
              <Button size="lg" variant="secondary" className="shadow-lg">
                Sign Up Now
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default LandingPage;
