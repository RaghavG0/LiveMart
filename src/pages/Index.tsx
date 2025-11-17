import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import CustomerDashboard from "@/components/dashboards/CustomerDashboard";
import RetailerDashboard from "@/components/dashboards/RetailerDashboard";
import WholesalerDashboard from "@/components/dashboards/WholesalerDashboard";
import LandingPage from "@/components/LandingPage";
import { toast } from "sonner";

type UserRole = "customer" | "retailer" | "wholesaler" | null;

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer fetching user role
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setUserRole(null);
          setLoading(false);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      setUserRole(data.role as UserRole);
    } catch (error) {
      console.error("Error fetching user role:", error);
      toast.error("Error loading user role");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">No role assigned. Please contact support.</p>
        </div>
      </div>
    );
  }

  switch (userRole) {
    case "customer":
      return <CustomerDashboard user={user} />;
    case "retailer":
      return <RetailerDashboard user={user} />;
    case "wholesaler":
      return <WholesalerDashboard user={user} />;
    default:
      return <LandingPage />;
  }
};

export default Index;
