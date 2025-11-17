import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { User, Store, Package } from "lucide-react";

interface RoleSelectorProps {
  onRoleSelected: () => void;
}

export const RoleSelector = ({ onRoleSelected }: RoleSelectorProps) => {
  const [selectedRole, setSelectedRole] = useState<"customer" | "retailer" | "wholesaler">("customer");
  const [loading, setLoading] = useState(false);

  const handleAssignRole = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in");
        return;
      }

      const { error } = await supabase.functions.invoke("assign-user-role", {
        body: { role: selectedRole },
      });

      if (error) throw error;

      toast.success(`Role assigned successfully! You are now a ${selectedRole}.`);
      onRoleSelected();
      window.location.reload();
    } catch (error: any) {
      console.error("Error assigning role:", error);
      toast.error(error.message || "Failed to assign role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Choose Your Role</CardTitle>
          <CardDescription>
            Select how you'd like to use Live MART. You can change this later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={selectedRole} onValueChange={(value: any) => setSelectedRole(value)}>
            <div className="space-y-4">
              <label
                htmlFor="customer"
                className={`flex items-start space-x-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedRole === "customer"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value="customer" id="customer" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-5 w-5 text-primary" />
                    <Label htmlFor="customer" className="text-lg font-semibold cursor-pointer">
                      Customer
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Browse products, add items to cart, place orders, and track deliveries.
                  </p>
                </div>
              </label>

              <label
                htmlFor="retailer"
                className={`flex items-start space-x-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedRole === "retailer"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value="retailer" id="retailer" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Store className="h-5 w-5 text-secondary" />
                    <Label htmlFor="retailer" className="text-lg font-semibold cursor-pointer">
                      Retailer
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Manage your store inventory, list products, handle customer orders, and grow your business.
                  </p>
                </div>
              </label>

              <label
                htmlFor="wholesaler"
                className={`flex items-start space-x-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedRole === "wholesaler"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value="wholesaler" id="wholesaler" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-accent" />
                    <Label htmlFor="wholesaler" className="text-lg font-semibold cursor-pointer">
                      Wholesaler
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Manage bulk inventory, supply products to retailers, and handle large-scale orders.
                  </p>
                </div>
              </label>
            </div>
          </RadioGroup>

          <Button
            onClick={handleAssignRole}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? "Assigning Role..." : "Continue"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
