import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, User as UserIcon, Save, LogOut, MapPin, Navigation, RefreshCw } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { LocationPicker } from "@/components/LocationPicker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import MyReviews from "@/components/feedback/MyReviews";
import { reverseGeocode, type AddressComponents } from "@/lib/reverseGeocode";

interface Profile {
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_area: string | null;
  location_city: string | null;
  location_district: string | null;
  location_state: string | null;
  location_country: string | null;
  location_pincode: string | null;
}

const Account = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>({
    full_name: "",
    phone: null,
    avatar_url: null,
    location_address: null,
    location_lat: null,
    location_lng: null,
    location_area: null,
    location_city: null,
    location_district: null,
    location_state: null,
    location_country: null,
    location_pincode: null,
  });
  const [userRole, setUserRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [capturingLocation, setCapturingLocation] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        fetchProfile(session.user.id);
        fetchUserRole(session.user.id);
      }
    });
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      if (data) {
        setProfile(data);
        
        // If we have coordinates but no address components, try to reverse geocode
        if (data.location_lat && data.location_lng && 
            (!data.location_address || data.location_address.match(/^\d+\.\d+,\s*\d+\.\d+$/))) {
          // Coordinates exist but address is missing or is just coordinates
          // Try to reverse geocode in background (non-blocking)
          const apiKey = import.meta.env.VITE_OLA_MAPS_API_KEY;
          if (apiKey) {
            reverseGeocode(Number(data.location_lat), Number(data.location_lng), apiKey)
              .then((addressComponents) => {
                // Update profile with address components
                setProfile(prev => ({
                  ...prev,
                  location_address: addressComponents.formatted_address || prev.location_address,
                  location_area: addressComponents.area || null,
                  location_city: addressComponents.city || null,
                  location_district: addressComponents.district || null,
                  location_state: addressComponents.state || null,
                  location_country: addressComponents.country || null,
                  location_pincode: addressComponents.pincode || null,
                }));
              })
              .catch((err) => {
                console.error('Background reverse geocoding failed:', err);
              });
          }
        }
      }
    } catch (error: any) {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      if (data) {
        setUserRole(data.role);
      }
    } catch (error: any) {
      console.error("Failed to load user role:", error);
    }
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
      enableHighAccuracy: attempt === 1, // Try high accuracy first, then fallback
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
          const apiKey = import.meta.env.VITE_OLA_MAPS_API_KEY;
          if (!apiKey) {
            throw new Error('Maps API key not configured');
          }

          const addressComponents: AddressComponents = await reverseGeocode(lat, lng, apiKey);

          setProfile({
            ...profile,
            location_lat: lat,
            location_lng: lng,
            location_address: addressComponents.formatted_address,
            location_area: addressComponents.area || null,
            location_city: addressComponents.city || null,
            location_district: addressComponents.district || null,
            location_state: addressComponents.state || null,
            location_country: addressComponents.country || null,
            location_pincode: addressComponents.pincode || null,
          });

          // Build display address
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
        } catch (error) {
          console.error('Reverse geocoding failed:', error);
          setProfile({
            ...profile,
            location_lat: lat,
            location_lng: lng,
            location_address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          });
          toast.success("Location captured (coordinates only)");
        }
        setCapturingLocation(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        
        // Retry up to 2 times with different settings
        if (attempt < 3 && error.code !== error.PERMISSION_DENIED) {
          setTimeout(() => {
            handleCaptureCurrentLocation(attempt + 1);
          }, 1000 * attempt); // Exponential backoff
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
            instruction = "Please try again or use 'Pick Location on Map' option.";
            break;
          default:
            errorMessage = "An unknown error occurred.";
            instruction = "Try using 'Pick Location on Map' option instead.";
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

  const handleGeocodeAddress = async () => {
    if (!profile.location_address?.trim()) {
      toast.error("Please enter an address");
      return;
    }

    try {
      const response = await fetch(
        `https://api.olamaps.io/places/v1/geocode?address=${encodeURIComponent(profile.location_address)}&api_key=${import.meta.env.VITE_OLA_MAPS_API_KEY}`
      );
      const data = await response.json();
      
      if (data.geocodingResults?.[0]) {
        const result = data.geocodingResults[0];
        setProfile({
          ...profile,
          location_lat: result.geometry.location.lat,
          location_lng: result.geometry.location.lng,
        });
        toast.success("Address geocoded successfully");
      } else {
        toast.error("Could not find coordinates for this address");
      }
    } catch (error) {
      toast.error("Failed to geocode address");
    }
  };

  const handleLocationSelect = async (lat: number, lng: number, address: string, addressComponents?: AddressComponents) => {
    if (addressComponents) {
      // Use address components from LocationPicker
      setProfile({
        ...profile,
        location_lat: lat,
        location_lng: lng,
        location_address: addressComponents.formatted_address || address,
        location_area: addressComponents.area || null,
        location_city: addressComponents.city || null,
        location_district: addressComponents.district || null,
        location_state: addressComponents.state || null,
        location_country: addressComponents.country || null,
        location_pincode: addressComponents.pincode || null,
      });
    } else {
      // Fallback: Get address components if not provided
      try {
        const apiKey = import.meta.env.VITE_OLA_MAPS_API_KEY;
        if (apiKey) {
          const components: AddressComponents = await reverseGeocode(lat, lng, apiKey);
          setProfile({
            ...profile,
            location_lat: lat,
            location_lng: lng,
            location_address: components.formatted_address || address,
            location_area: components.area || null,
            location_city: components.city || null,
            location_district: components.district || null,
            location_state: components.state || null,
            location_country: components.country || null,
            location_pincode: components.pincode || null,
          });
        } else {
          setProfile({
            ...profile,
            location_lat: lat,
            location_lng: lng,
            location_address: address,
          });
        }
      } catch (error) {
        console.error('Failed to get address components:', error);
        setProfile({
          ...profile,
          location_lat: lat,
          location_lng: lng,
          location_address: address,
        });
      }
    }
    setLocationDialogOpen(false);
    toast.success("Location updated");
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
          location_address: profile.location_address,
          location_lat: profile.location_lat,
          location_lng: profile.location_lng,
          location_area: profile.location_area,
          location_city: profile.location_city,
          location_district: profile.location_district,
          location_state: profile.location_state,
          location_country: profile.location_country,
          location_pincode: profile.location_pincode,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Profile updated successfully");
      if ((userRole === 'retailer' || userRole === 'wholesaler') && profile.location_lat && profile.location_lng) {
        toast.success("Location saved! You can now create products.", { duration: 4000 });
      }
    } catch (error: any) {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading account...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="text-4xl font-bold mb-8 bg-gradient-primary bg-clip-text text-transparent">
          My Account
        </h1>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your personal information and contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-sm text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Account Type</Label>
                <Input
                  id="role"
                  value={userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                  disabled
                  className="bg-muted capitalize"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={profile.full_name}
                  onChange={(e) =>
                    setProfile({ ...profile, full_name: e.target.value })
                  }
                  placeholder="Enter your full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profile.phone || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, phone: e.target.value })
                  }
                  placeholder="Enter your phone number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <div className="flex gap-2">
                  <Input
                    id="address"
                    value={
                      profile.location_address && !profile.location_address.match(/^\d+\.\d+,\s*\d+\.\d+$/)
                        ? profile.location_address
                        : profile.location_area || profile.location_city || profile.location_state
                          ? [profile.location_area, profile.location_city, profile.location_district, 
                             profile.location_state, profile.location_pincode].filter(Boolean).join(', ')
                          : profile.location_address || ""
                    }
                    onChange={(e) =>
                      setProfile({ ...profile, location_address: e.target.value })
                    }
                    placeholder="Enter your address or let it auto-fill from location"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGeocodeAddress}
                    disabled={!profile.location_address?.trim()}
                  >
                    <MapPin className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Click the pin icon to convert address to coordinates, or use location button below to auto-fill
                </p>
              </div>

              <Button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {(userRole === 'retailer' || userRole === 'wholesaler') ? 'Shop Location' : 'Location Settings'}
              </CardTitle>
              <CardDescription>
                {(userRole === 'retailer' || userRole === 'wholesaler') 
                  ? 'Your shop location helps customers find you on the map and filter products by distance. This is required to list products.'
                  : 'Set your location for better product discovery'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(userRole === 'retailer' || userRole === 'wholesaler') && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-2 w-2 rounded-full ${profile.location_lat && profile.location_lng ? 'bg-green-500' : 'bg-orange-500'}`} />
                    <span className="font-medium text-sm">
                      Location Status: {profile.location_lat && profile.location_lng ? 'Complete ✓' : 'Incomplete'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {profile.location_lat && profile.location_lng 
                      ? 'Your shop is visible to customers on the map'
                      : 'Set your location to start listing products and appear on the map'}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="location">Current Location</Label>
                <div className="flex gap-2">
                  <Input
                    id="location"
                    value={
                      profile.location_address && !profile.location_address.match(/^\d+\.\d+,\s*\d+\.\d+$/)
                        ? profile.location_address
                        : profile.location_city && profile.location_state
                          ? `${profile.location_city}, ${profile.location_state}${profile.location_pincode ? ` ${profile.location_pincode}` : ''}`
                          : profile.location_area || profile.location_city || profile.location_state
                            ? [profile.location_area, profile.location_city, profile.location_state, profile.location_pincode].filter(Boolean).join(', ')
                            : profile.location_lat && profile.location_lng
                              ? `${profile.location_lat.toFixed(6)}, ${profile.location_lng.toFixed(6)}`
                              : "Not set"
                    }
                    disabled
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCaptureCurrentLocation(1)}
                    disabled={capturingLocation}
                  >
                    {capturingLocation ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Navigation className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {profile.location_lat && profile.location_lng && (
                  <div className="text-xs text-muted-foreground space-y-2">
                    <p className="text-xs">Coordinates: {profile.location_lat.toFixed(6)}, {profile.location_lng.toFixed(6)}</p>
                    {(profile.location_area || profile.location_city || profile.location_district || 
                      profile.location_state || profile.location_country || profile.location_pincode) ? (
                      <div className="mt-2 pt-2 border-t border-border bg-muted/30 p-3 rounded-lg">
                        <p className="font-medium text-foreground mb-2 text-sm">Address Details:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {profile.location_area && (
                            <div>
                              <span className="font-medium text-foreground">Area/Locality: </span>
                              <span>{profile.location_area}</span>
                            </div>
                          )}
                          {profile.location_city && (
                            <div>
                              <span className="font-medium text-foreground">City: </span>
                              <span>{profile.location_city}</span>
                            </div>
                          )}
                          {profile.location_district && (
                            <div>
                              <span className="font-medium text-foreground">District: </span>
                              <span>{profile.location_district}</span>
                            </div>
                          )}
                          {profile.location_state && (
                            <div>
                              <span className="font-medium text-foreground">State: </span>
                              <span>{profile.location_state}</span>
                            </div>
                          )}
                          {profile.location_country && (
                            <div>
                              <span className="font-medium text-foreground">Country: </span>
                              <span>{profile.location_country}</span>
                            </div>
                          )}
                          {profile.location_pincode && (
                            <div>
                              <span className="font-medium text-foreground">Pincode: </span>
                              <span>{profile.location_pincode}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground italic">
                          Address details not available. Click the location button to update with full address.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <MapPin className="mr-2 h-4 w-4" />
                    Pick Location on Map
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
                    initialLat={profile.location_lat}
                    initialLng={profile.location_lng}
                    onLocationSelect={handleLocationSelect}
                    apiKey={import.meta.env.VITE_OLA_MAPS_API_KEY}
                  />
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {userRole === "customer" && <MyReviews />}

          <Card>
            <CardHeader>
              <CardTitle>Account Actions</CardTitle>
              <CardDescription>
                Manage your account settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={handleSignOut}
                className="w-full sm:w-auto"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Account;
