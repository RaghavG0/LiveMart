import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertCircle, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SignupData {
  email: string;
  mobile: string;
  password: string;
}

const VerifyOTP = () => {
  const navigate = useNavigate();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [signupData, setSignupData] = useState<SignupData | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Load signup data from sessionStorage
  useEffect(() => {
    const storedData = sessionStorage.getItem("signupData");
    if (!storedData) {
      toast.error("No signup data found. Please start over.");
      navigate("/signup");
      return;
    }

    try {
      const data = JSON.parse(storedData) as SignupData;
      setSignupData(data);
    } catch (error) {
      toast.error("Invalid signup data. Please start over.");
      navigate("/signup");
    }
  }, [navigate]);

  // Send OTP on component mount
  useEffect(() => {
    if (signupData) {
      sendOTP();
      startTimer();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signupData]);

  // Timer logic
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

  const sendOTP = async () => {
    if (!signupData) return;

    setSendingOTP(true);
    setOtpError("");

    try {
      const { data, error } = await supabase.functions.invoke("send-signup-otp", {
        body: {
          email: signupData.email,
          phone: signupData.mobile || null,
          otpType: "email",
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("OTP sent to your email");
        startTimer(); // Restart timer after sending
      } else {
        const errorMsg = data?.error || "Failed to send OTP";
        // Check if account already exists
        if (errorMsg.includes("already exists") || errorMsg.includes("Account")) {
          toast.error("Account already exists. Please login instead.");
          sessionStorage.removeItem("signupData");
          navigate("/auth");
          return;
        }
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      const errorMessage = error.message || "Failed to send OTP. Please try again.";
      if (errorMessage.includes("already exists") || errorMessage.includes("Account")) {
        toast.error("Account already exists. Please login instead.");
        sessionStorage.removeItem("signupData");
        navigate("/auth");
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSendingOTP(false);
    }
  };

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

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split("");
      setOtp(digits);
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    if (!signupData) return;

    const otpString = otp.join("");
    if (otpString.length !== 6) {
      setOtpError("Please enter the complete 6-digit OTP");
      return;
    }

    setLoading(true);
    setOtpError("");

    try {
      const { data, error } = await supabase.functions.invoke("verify-signup-otp", {
        body: {
          email: signupData.email,
          otp: otpString,
          password: signupData.password,
          fullName: signupData.email.split("@")[0], // Use email prefix as default name
          phone: signupData.mobile,
          role: "customer", // Default role, can be customized
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Account created successfully!");
        
        // Clear signup data
        sessionStorage.removeItem("signupData");

        // Sign in the user
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: signupData.email,
          password: signupData.password,
        });

        if (signInError) {
          console.error("Auto sign-in error:", signInError);
          toast.info("Account created! Please sign in manually.");
          navigate("/auth");
        } else {
          navigate("/");
        }
      } else {
        throw new Error(data?.error || "Verification failed");
      }
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      const errorMessage = error.message || "Failed to verify OTP";
      
      if (errorMessage.includes("OTP Mismatch")) {
        setOtpError("OTP Mismatch, please try again.");
      } else {
        setOtpError(errorMessage);
      }
      
      // Clear OTP on error
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  if (!signupData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Verify Your Email
          </CardTitle>
          <CardDescription className="text-center">
            We've sent a 6-digit OTP to {signupData.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {otpError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{otpError}</AlertDescription>
            </Alert>
          )}

          {/* OTP Input */}
          <div className="space-y-2">
            <Label>Enter OTP</Label>
            <div className="flex gap-2 justify-center" onPaste={handlePaste}>
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
                  disabled={loading}
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
              onClick={handleVerify}
              className="w-full"
              disabled={loading || otp.join("").length !== 6}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Create Account"
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={sendOTP}
              disabled={!canResend || sendingOTP}
            >
              <Mail className="mr-2 h-4 w-4" />
              {sendingOTP ? "Sending..." : "Resend OTP"}
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem("signupData");
                navigate("/signup");
              }}
              className="text-primary hover:underline"
            >
              Back to Sign Up
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyOTP;

