import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, User as UserIcon, Save, LogOut, MapPin, Navigation } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { LocationPicker } from "@/components/LocationPicker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Profile {
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
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

  const handleCaptureCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setCapturingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // Reverse geocode to get address
        try {
          const response = await fetch(
            `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lng}&api_key=${import.meta.env.VITE_OLA_MAPS_API_KEY}`
          );
          const data = await response.json();
          const address = data.results?.[0]?.formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

          setProfile({
            ...profile,
            location_lat: lat,
            location_lng: lng,
            location_address: address,
          });

          toast.success("Location captured successfully");
        } catch (error) {
          setProfile({
            ...profile,
            location_lat: lat,
            location_lng: lng,
            location_address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          });
          toast.success("Location captured");
        }
        setCapturingLocation(false);
      },
      (error) => {
        toast.error("Unable to get your location");
        setCapturingLocation(false);
      }
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

  const handleLocationSelect = (lat: number, lng: number, address: string) => {
    setProfile({
      ...profile,
      location_lat: lat,
      location_lng: lng,
      location_address: address,
    });
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
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Profile updated successfully");
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
                    value={profile.location_address || ""}
                    onChange={(e) =>
                      setProfile({ ...profile, location_address: e.target.value })
                    }
                    placeholder="Enter your address"
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
                  Click the pin icon to convert address to coordinates
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
                Location Settings
              </CardTitle>
              <CardDescription>
                Set your location for better product discovery
                {(userRole === "retailer" || userRole === "wholesaler") && (
                  <span className="block mt-1 text-amber-600 dark:text-amber-500 font-medium">
                    Required for sellers to list products
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location">Current Location</Label>
                <div className="flex gap-2">
                  <Input
                    id="location"
                    value={profile.location_address || "Not set"}
                    disabled
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCaptureCurrentLocation}
                    disabled={capturingLocation}
                  >
                    {capturingLocation ? (
                      <Navigation className="h-4 w-4 animate-pulse" />
                    ) : (
                      <Navigation className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {profile.location_lat && profile.location_lng && (
                  <p className="text-xs text-muted-foreground">
                    Coordinates: {profile.location_lat.toFixed(6)}, {profile.location_lng.toFixed(6)}
                  </p>
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
