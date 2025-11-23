import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Navigation, RefreshCw, MapPin } from "lucide-react";
import { toast } from "sonner";
import { reverseGeocode, type AddressComponents } from "@/lib/reverseGeocode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LocationPicker } from "@/components/LocationPicker";

export interface AddressFormData {
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  label: "Home" | "Work" | "Other";
  is_default: boolean;
}

interface AddressFormProps {
  initialData?: Partial<AddressFormData>;
  onSubmit: (data: AddressFormData) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  loading?: boolean;
}

const AddressForm = ({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = "Save Address",
  loading = false,
}: AddressFormProps) => {
  const [formData, setFormData] = useState<AddressFormData>({
    address_line_1: initialData?.address_line_1 || "",
    address_line_2: initialData?.address_line_2 || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    zip: initialData?.zip || "",
    country: initialData?.country || "India",
    phone: initialData?.phone || "",
    label: initialData?.label || "Home",
    is_default: initialData?.is_default || false,
  });
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleCaptureCurrentLocation = async (attempt: number = 1) => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    // Check if running on HTTPS or localhost
    if (window.location.protocol !== 'https:' && !window.location.hostname.includes('localhost')) {
      toast.error("Location access requires a secure connection (HTTPS)");
      return;
    }

    // Check permission state if available
    try {
      if ('permissions' in navigator) {
        const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (result.state === 'denied') {
          toast.error("Location permission denied. Please enable it in your browser settings.");
          return;
        }
      }
    } catch (e) {
      console.log('Permission check not supported:', e);
    }

    setCapturingLocation(true);
    if (attempt === 1) {
      toast.info("Requesting location access...");
    }
    
    const geoOptions: PositionOptions = {
      enableHighAccuracy: attempt === 1,
      timeout: attempt === 1 ? 20000 : 15000,
      maximumAge: attempt === 1 ? 0 : 300000
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        console.log('Location captured:', { lat, lng, accuracy: position.coords.accuracy });

        // Reverse geocode to get address components
        try {
          const addressComponents: AddressComponents | null = await reverseGeocode(lat, lng);

          if (addressComponents) {
            // Populate form fields with address components
            setFormData({
              ...formData,
              address_line_1: addressComponents.area || addressComponents.formatted_address.split(',')[0] || "",
              address_line_2: "",
              city: addressComponents.city || "",
              state: addressComponents.state || "",
              zip: addressComponents.pincode || "",
              country: addressComponents.country || "India",
            });

            // Build display address for toast
            const addressParts = [
              addressComponents.area,
              addressComponents.city,
              addressComponents.district,
              addressComponents.state,
              addressComponents.pincode,
            ].filter(Boolean);
            const displayAddress = addressParts.length > 0 
              ? addressParts.join(', ')
              : addressComponents.formatted_address;

            toast.success(`Location captured: ${displayAddress}`);
          }
        } catch (error) {
          console.error('Reverse geocoding failed:', error);
          toast.success("Location captured (coordinates only). Please fill in address details manually.");
        }
        setCapturingLocation(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        
        // Retry up to 2 times with different settings
        if (attempt < 3 && error.code !== error.PERMISSION_DENIED) {
          setTimeout(() => {
            handleCaptureCurrentLocation(attempt + 1);
          }, 1000 * attempt);
          return;
        }

        let errorMessage = "Unable to get your location. ";
        let instruction = "";
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied.";
            instruction = "Click the 🔒 icon in your browser's address bar and enable location access.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            instruction = "Make sure GPS/location services are enabled on your device.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out.";
            instruction = "Please try again.";
            break;
          default:
            errorMessage = "An unknown error occurred.";
            instruction = "Please enter address manually.";
        }
        
        toast.error(errorMessage, {
          description: instruction,
          duration: 5000,
        });
        setCapturingLocation(false);
      },
      geoOptions
    );
  };

  const handleLocationSelect = async (lat: number, lng: number, address: string, addressComponents?: AddressComponents) => {
    if (addressComponents) {
      // Use address components from LocationPicker
      setFormData({
        ...formData,
        address_line_1: addressComponents.area || addressComponents.formatted_address.split(',')[0] || "",
        address_line_2: "",
        city: addressComponents.city || "",
        state: addressComponents.state || "",
        zip: addressComponents.pincode || "",
        country: addressComponents.country || "India",
      });
    } else {
      // Fallback: Get address components if not provided
      try {
        const components: AddressComponents | null = await reverseGeocode(lat, lng);
        if (components) {
          setFormData({
            ...formData,
            address_line_1: components.area || components.formatted_address.split(',')[0] || "",
            address_line_2: "",
            city: components.city || "",
            state: components.state || "",
            zip: components.pincode || "",
            country: components.country || "India",
          });
        } else {
          setFormData({
            ...formData,
            address_line_1: address || "",
          });
        }
      } catch (error) {
        console.error('Failed to get address components:', error);
        setFormData({
          ...formData,
          address_line_1: address || "",
        });
      }
    }
    setLocationDialogOpen(false);
    toast.success("Location updated");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4 pb-4 border-b space-y-3">
        <div>
          <Label className="text-base font-semibold">Address Details</Label>
          <p className="text-sm text-muted-foreground">Fill manually or use automatic location</p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleCaptureCurrentLocation()}
            disabled={capturingLocation}
            className="flex items-center gap-2"
          >
            {capturingLocation ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Capturing...
              </>
            ) : (
              <>
                <Navigation className="h-4 w-4" />
                Use Current Location
              </>
            )}
          </Button>
          <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Pick on Map
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Select Your Location</DialogTitle>
                <DialogDescription>
                  Drag the marker to set your exact location
                </DialogDescription>
              </DialogHeader>
              <LocationPicker
                initialLat={null}
                initialLng={null}
                onLocationSelect={handleLocationSelect}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="label">Address Label</Label>
        <Select
          value={formData.label}
          onValueChange={(value: "Home" | "Work" | "Other") =>
            setFormData({ ...formData, label: value })
          }
        >
          <SelectTrigger id="label">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Home">Home</SelectItem>
            <SelectItem value="Work">Work</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address_line_1">Address Line 1 *</Label>
        <Input
          id="address_line_1"
          value={formData.address_line_1}
          onChange={(e) =>
            setFormData({ ...formData, address_line_1: e.target.value })
          }
          placeholder="Street address, apartment, suite, etc."
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address_line_2">Address Line 2</Label>
        <Input
          id="address_line_2"
          value={formData.address_line_2}
          onChange={(e) =>
            setFormData({ ...formData, address_line_2: e.target.value })
          }
          placeholder="Apartment, suite, unit, building, floor, etc. (optional)"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="state">State *</Label>
          <Input
            id="state"
            value={formData.state}
            onChange={(e) =>
              setFormData({ ...formData, state: e.target.value })
            }
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="zip">ZIP / Postal Code *</Label>
          <Input
            id="zip"
            value={formData.zip}
            onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={formData.country}
            onChange={(e) =>
              setFormData({ ...formData, country: e.target.value })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) =>
            setFormData({ ...formData, phone: e.target.value })
          }
          placeholder="10-digit mobile number"
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="is_default"
          checked={formData.is_default}
          onChange={(e) =>
            setFormData({ ...formData, is_default: e.target.checked })
          }
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="is_default" className="cursor-pointer">
          Set as default address
        </Label>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Saving..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
};

export default AddressForm;

