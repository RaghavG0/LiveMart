import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Home, Briefcase, MapPinIcon, Check } from "lucide-react";
import AddressForm, { AddressFormData } from "./AddressForm";
import type { Address } from "./AddressList";

interface AddressSelectorProps {
  userId: string;
  selectedAddressId: string | null;
  onAddressSelect: (addressId: string | null) => void;
  onManualAddressChange?: (address: string) => void;
}

const AddressSelector = ({
  userId,
  selectedAddressId,
  onAddressSelect,
  onManualAddressChange,
}: AddressSelectorProps) => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manualAddress, setManualAddress] = useState("");

  useEffect(() => {
    fetchAddresses();
  }, [userId]);

  useEffect(() => {
    // Set default address if available and no selection yet
    if (!selectedAddressId && addresses.length > 0) {
      const defaultAddress = addresses.find((addr) => addr.is_default);
      if (defaultAddress) {
        onAddressSelect(defaultAddress.id);
      } else {
        // If no default, select first address
        onAddressSelect(addresses[0].id);
      }
    }
  }, [addresses, selectedAddressId, onAddressSelect]);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_addresses")
        .select("*")
        .eq("user_id", userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (error: any) {
      console.error("Error fetching addresses:", error);
      toast.error("Failed to load addresses");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAddress = async (formData: AddressFormData) => {
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from("user_addresses")
        .insert({
          user_id: userId,
          ...formData,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success("Address added successfully");
      setShowAddDialog(false);
      
      // Fetch updated addresses
      await fetchAddresses();
      
      // Auto-select the newly added address
      if (data) {
        onAddressSelect(data.id);
      }
    } catch (error: any) {
      console.error("Error saving address:", error);
      toast.error(error.message || "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  const getLabelIcon = (label: string) => {
    switch (label) {
      case "Home":
        return <Home className="h-4 w-4" />;
      case "Work":
        return <Briefcase className="h-4 w-4" />;
      default:
        return <MapPinIcon className="h-4 w-4" />;
    }
  };

  const selectedAddress = addresses.find((addr) => addr.id === selectedAddressId);

  if (loading) {
    return <div className="text-center py-4 text-muted-foreground">Loading addresses...</div>;
  }

  return (
    <div className="space-y-4">
      {addresses.length > 0 ? (
        <RadioGroup value={selectedAddressId || ""} onValueChange={onAddressSelect}>
          <div className="space-y-3">
            {addresses.map((address) => (
              <div key={address.id}>
                <RadioGroupItem
                  value={address.id}
                  id={address.id}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={address.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-muted bg-card p-4 hover:bg-accent peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getLabelIcon(address.label)}
                      <span className="font-semibold">{address.label}</span>
                      {address.is_default && (
                        <Badge variant="secondary" className="text-xs">
                          Default
                        </Badge>
                      )}
                      {selectedAddressId === address.id && (
                        <Check className="h-4 w-4 text-primary ml-auto" />
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>{address.address_line_1}</p>
                      {address.address_line_2 && <p>{address.address_line_2}</p>}
                      <p>
                        {address.city}, {address.state} {address.zip}
                      </p>
                      {address.phone && <p>Phone: {address.phone}</p>}
                    </div>
                  </div>
                </Label>
              </div>
            ))}
          </div>
        </RadioGroup>
      ) : (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
          <p className="mb-2">No saved addresses</p>
          <p className="text-sm">Add an address to continue</p>
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add New Address
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Address</DialogTitle>
          </DialogHeader>
          <AddressForm
            onSubmit={handleSaveAddress}
            onCancel={() => setShowAddDialog(false)}
            loading={saving}
          />
        </DialogContent>
      </Dialog>

      {/* Manual Address Input (Fallback) */}
      <div className="pt-4 border-t">
        <Label htmlFor="manual-address" className="text-sm text-muted-foreground mb-2 block">
          Or enter address manually
        </Label>
        <textarea
          id="manual-address"
          placeholder="Enter your complete delivery address"
          value={manualAddress}
          onChange={(e) => {
            setManualAddress(e.target.value);
            onAddressSelect(null); // Clear selected address when manual input is used
            onManualAddressChange?.(e.target.value); // Notify parent
          }}
          className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        {manualAddress && (
          <p className="text-xs text-muted-foreground mt-1">
            This address will be used for delivery. It won't be saved to your address book.
          </p>
        )}
      </div>
      
      {/* Expose manualAddress via ref or callback for parent access */}
    </div>
  );
};

export default AddressSelector;

