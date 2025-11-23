import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ShoppingBag, Store, Warehouse, Navigation, MapPin, AlertCircle, Mail, Loader2 } from "lucide-react";

type UserRole = "customer" | "retailer" | "wholesaler";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>(
    (searchParams.get("role") as UserRole) || "customer"
  );
  const [locationAddress, setLocationAddress] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [capturingLocation, setCapturingLocation] = useState(false);

  // =====================================================
  // OTP STATE VARIABLES - Critical for state transitions
  // =====================================================
  const [showOtp, setShowOtp] = useState(false); // Controls whether OTP form is shown
  const [otpSent, setOtpSent] = useState(false); // Tracks if OTP has been sent
  const [otpEmail, setOtpEmail] = useState(""); // Stores email for OTP verification
  const [otp, setOtp] = useState(["", "", "", "", "", ""]); // OTP input values
  const [sendingOTP, setSendingOTP] = useState(false); // Loading state for sending OTP
  const [otpError, setOtpError] = useState(""); // Error message for OTP
  const [timeLeft, setTimeLeft] = useState(30); // Resend timer
  const [canResend, setCanResend] = useState(false); // Whether resend is allowed
  const timerRef = useRef<NodeJS.Timeout | null>(null); // Timer reference
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]); // OTP input refs

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });
  }, [navigate]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // =====================================================
  // OTP TIMER LOGIC
  // =====================================================
  const startTimer = () => {
    setTimeLeft(30);
    setCanResend(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // =====================================================
  // SEND OTP FUNCTION - Called when user is new or requests OTP login
  // =====================================================
  const sendOTP = async (userEmail: string) => {
    setSendingOTP(true);
    setOtpError("");

    try {
      const { data, error } = await supabase.functions.invoke("send-signup-otp", {
        body: {
          email: userEmail,
          phone: null,
          otpType: "email",
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("OTP sent to your email");
        setOtpSent(true);
        startTimer(); // Start the resend timer
      } else {
        const errorMsg = data?.error || "Failed to send OTP";
        // Check if account already exists
        if (errorMsg.includes("already exists") || errorMsg.includes("Account")) {
          toast.error("Account already exists. Please use password to login.");
          setShowOtp(false);
          setOtpSent(false);
          return;
        }
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      const errorMessage = error.message || "Failed to send OTP. Please try again.";
      setOtpError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSendingOTP(false);
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

        try {
          // Use Nominatim for reverse geocoding (free, no API key required)
          const { reverseGeocode } = await import('@/lib/reverseGeocode');
          const addressComponents = await reverseGeocode(lat, lng);
          const address = addressComponents?.formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

          setLocationAddress(address);
          setLocationLat(lat);
          setLocationLng(lng);
          toast.success("Location captured successfully");
        } catch (error) {
          setLocationAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
          setLocationLat(lat);
          setLocationLng(lng);
          toast.success("Location captured");
        }
        setCapturingLocation(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        let errorMessage = "Unable to get your location. ";
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += "Please enable location permissions in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage += "Location request timed out. Please try again.";
            break;
          default:
            errorMessage += "An unknown error occurred.";
        }
        
        toast.error(errorMessage);
        setCapturingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleGeocodeAddress = async () => {
    if (!locationAddress.trim()) {
      toast.error("Please enter an address");
      return;
    }

    try {
      // Use Nominatim for forward geocoding (free, no API key required)
      const { forwardGeocode } = await import('@/lib/reverseGeocode');
      const coords = await forwardGeocode(locationAddress);
      
      if (coords) {
        setLocationLat(coords.lat);
        setLocationLng(coords.lng);
        toast.success("Address geocoded successfully");
      }
    } catch (error) {
      toast.error("Failed to geocode address");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate location for sellers
    if ((selectedRole === "retailer" || selectedRole === "wholesaler") && (!locationLat || !locationLng)) {
      toast.error("Please set your location. It's required for sellers.");
      return;
    }

    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            phone: phone,
            role: selectedRole,
            location_address: locationAddress || null,
            location_lat: locationLat,
            location_lng: locationLng,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        toast.success("Account created! Please check your email to verify.");
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message || "Error signing up");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // MODIFIED SIGN IN FUNCTION - Requires OTP Verification
  // =====================================================
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setOtpError("");

    try {
      // Step 1: Validate credentials and send OTP (DO NOT authenticate yet)
      console.log("Calling send-login-otp for email:", email);
      
      // Use fetch directly to avoid automatic auth header injection
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-login-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY || "",
            // Don't include Authorization header - this is for login
          },
          body: JSON.stringify({
            email: email.trim(),
            password: password,
          }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        console.error("send-login-otp error:", result);
        throw new Error(result.error || "Failed to send OTP");
      }
      
      const data = result;

      if (!data?.success) {
        // Invalid credentials or other error
        const errorMsg = data?.error || "Failed to send OTP";
        if (errorMsg.includes("Invalid email") || errorMsg.includes("Invalid password")) {
          toast.error("Invalid email or password");
        } else {
          toast.error(errorMsg);
        }
        return;
      }

      // Step 2: Store credentials temporarily in sessionStorage for OTP verification
      // This is needed because we'll need the password again to authenticate after OTP verification
      sessionStorage.setItem(
        "loginData",
        JSON.stringify({
          email,
          password, // Stored temporarily - will be cleared after successful login
          timestamp: Date.now(), // For security - expire after 15 minutes
        })
      );

      // Step 3: Redirect to OTP verification page
      toast.success("OTP sent to your email. Please verify to continue.");
      navigate("/verify-login-otp");
      
    } catch (error: any) {
      console.error("Error in login flow:", error);
      toast.error(error.message || "Error signing in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // OTP INPUT HANDLERS
  // =====================================================
  const handleOTPChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setOtpError("");

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOTPPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split("");
      setOtp(digits);
      inputRefs.current[5]?.focus();
    }
  };

  // =====================================================
  // OTP VERIFICATION FUNCTION - Verifies OTP and logs in or creates account
  // =====================================================
  const handleVerifyOTP = async () => {
    if (!otpEmail) {
      toast.error("Email not found. Please try again.");
      return;
    }

    const otpString = otp.join("");
    if (otpString.length !== 6) {
      setOtpError("Please enter the complete 6-digit OTP");
      return;
    }

    setLoading(true);
    setOtpError("");

    try {
      // First, verify the OTP with the backend
      const { data, error } = await supabase.functions.invoke("verify-signup-otp", {
        body: {
          email: otpEmail,
          otp: otpString,
          password: password || `temp${Date.now()}`, // Temporary password if not set
          fullName: otpEmail.split("@")[0], // Use email prefix as default name
          phone: phone || null,
          role: "customer", // Default role
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Verification successful!");

        // Try to sign in with the account
        // If password was provided, use it; otherwise, the account was just created
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: otpEmail,
          password: password || `temp${Date.now()}`,
        });

        if (signInError) {
          // Account was created but sign-in failed - user may need to set password
          toast.info("Account verified! Please sign in with your password.");
          setShowOtp(false); // Hide OTP form
          setOtpSent(false);
          return;
        }

        // Successful sign-in
        // Reset OTP state for next time
        setShowOtp(false);
        setOtpSent(false);
        setOtp(["", "", "", "", "", ""]);
        setOtpError("");
        toast.success("Signed in successfully!");
        navigate("/");
      } else {
        throw new Error(data?.error || "Verification failed");
      }
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      const errorMessage = error.message || "Failed to verify OTP";
      
      if (errorMessage.includes("OTP Mismatch") || errorMessage.includes("Invalid")) {
        setOtpError("Invalid OTP. Please try again.");
      } else {
        setOtpError(errorMessage);
      }
      
      // Clear OTP on error
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Error signing in with Google");
    }
  };

  const roleOptions = [
    { value: "customer", label: "Customer", icon: ShoppingBag, description: "Browse and purchase products" },
    { value: "retailer", label: "Retailer", icon: Store, description: "Sell products to customers" },
    { value: "wholesaler", label: "Wholesaler", icon: Warehouse, description: "Supply products to retailers" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center bg-gradient-primary bg-clip-text text-transparent">
            Live MART
          </CardTitle>
          <CardDescription className="text-center">
            Your trusted online delivery system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs 
            defaultValue="signin" 
            className="w-full"
            onValueChange={(value) => {
              // Reset OTP state when switching tabs to ensure clean state
              if (value === "signup" || (value === "signin" && showOtp)) {
                setShowOtp(false);
                setOtpSent(false);
                setOtp(["", "", "", "", "", ""]);
                setOtpError("");
                setOtpEmail("");
                if (timerRef.current) {
                  clearInterval(timerRef.current);
                }
              }
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              {/* =====================================================
                  CONDITIONAL RENDERING: Show OTP form when showOtp is true
                  This is the critical UI state transition fix
                  ===================================================== */}
              {!showOtp ? (
                // LOGIN FORM - Shown by default
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Google
                  </Button>
                </form>
              ) : (
                // OTP VERIFICATION FORM - Shown when showOtp is true
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">Verify Your Email</h3>
                    <p className="text-sm text-muted-foreground">
                      We've sent a 6-digit OTP to <strong>{otpEmail}</strong>
                    </p>
                  </div>

                  {otpError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{otpError}</AlertDescription>
                    </Alert>
                  )}

                  {/* OTP Input */}
                  <div className="space-y-2">
                    <Label>Enter OTP</Label>
                    <div className="flex gap-2 justify-center" onPaste={handleOTPPaste}>
                      {otp.map((digit, index) => (
                        <Input
                          key={index}
                          ref={(el) => (inputRefs.current[index] = el)}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOTPChange(index, e.target.value)}
                          onKeyDown={(e) => handleOTPKeyDown(index, e)}
                          className="w-12 h-12 text-center text-lg font-semibold"
                          disabled={loading || sendingOTP}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Timer Display */}
                  <div className="text-center">
                    {timeLeft > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Resend OTP in {timeLeft} seconds
                      </p>
                    ) : (
                      <p className="text-sm text-green-600 font-medium">
                        You can now resend OTP
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <Button
                      onClick={handleVerifyOTP}
                      className="w-full"
                      disabled={loading || otp.join("").length !== 6}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Verify & Continue"
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => sendOTP(otpEmail)}
                      disabled={!canResend || sendingOTP}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      {sendingOTP ? "Sending..." : "Resend OTP"}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        // Reset OTP state and go back to login form
                        setShowOtp(false);
                        setOtpSent(false);
                        setOtp(["", "", "", "", "", ""]);
                        setOtpError("");
                        setOtpEmail("");
                        if (timerRef.current) {
                          clearInterval(timerRef.current);
                        }
                      }}
                    >
                      Back to Login
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-role">I am a</Label>
                  <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
                    <SelectTrigger id="signup-role">
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <option.icon className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{option.label}</div>
                              <div className="text-xs text-muted-foreground">{option.description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">Phone (Optional)</Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="+1234567890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                {(selectedRole === "retailer" || selectedRole === "wholesaler") && (
                  <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-500">
                      <MapPin className="h-4 w-4" />
                      Location (Required for sellers)
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="locationAddress">Shop Address</Label>
                      <div className="flex gap-2">
                        <Input
                          id="locationAddress"
                          value={locationAddress}
                          onChange={(e) => setLocationAddress(e.target.value)}
                          placeholder="Enter your shop address"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCaptureCurrentLocation}
                          disabled={capturingLocation}
                          title="Use current location"
                        >
                          {capturingLocation ? (
                            <Navigation className="h-4 w-4 animate-pulse" />
                          ) : (
                            <Navigation className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGeocodeAddress}
                      className="w-full"
                      disabled={!locationAddress.trim()}
                    >
                      <MapPin className="mr-2 h-4 w-4" />
                      Convert Address to Coordinates
                    </Button>

                    {locationLat && locationLng && (
                      <p className="text-xs text-muted-foreground">
                        ✓ Coordinates: {locationLat.toFixed(6)}, {locationLng.toFixed(6)}
                      </p>
                    )}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
