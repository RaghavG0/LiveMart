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

interface LoginData {
  email: string;
  password: string;
  timestamp: number;
}

const VerifyLoginOTP = () => {
  const navigate = useNavigate();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loginData, setLoginData] = useState<LoginData | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Load login data from sessionStorage
  useEffect(() => {
    const storedData = sessionStorage.getItem("loginData");
    if (!storedData) {
      toast.error("No login session found. Please sign in again.");
      navigate("/auth");
      return;
    }

    try {
      const data = JSON.parse(storedData) as LoginData;
      
      // Check if login data is expired (15 minutes)
      const fifteenMinutes = 15 * 60 * 1000;
      if (Date.now() - data.timestamp > fifteenMinutes) {
        sessionStorage.removeItem("loginData");
        toast.error("Login session expired. Please sign in again.");
        navigate("/auth");
        return;
      }

      setLoginData(data);
    } catch (error) {
      toast.error("Invalid login data. Please sign in again.");
      navigate("/auth");
    }
  }, [navigate]);

  // Send OTP on component mount if login data exists
  useEffect(() => {
    if (loginData) {
      sendOTP();
      startTimer();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginData]);

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
    if (!loginData) return;

    setSendingOTP(true);
    setOtpError("");

    try {
      const { data, error } = await supabase.functions.invoke("send-login-otp", {
        body: {
          email: loginData.email,
          password: loginData.password,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("OTP sent to your email");
        startTimer(); // Restart timer after sending
      } else {
        const errorMsg = data?.error || "Failed to send OTP";
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      const errorMessage = error.message || "Failed to send OTP. Please try again.";
      toast.error(errorMessage);
      setOtpError(errorMessage);
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
    if (!loginData) return;

    const otpString = otp.join("");
    if (otpString.length !== 6) {
      setOtpError("Please enter the complete 6-digit OTP");
      return;
    }

    setLoading(true);
    setOtpError("");

    try {
      // Verify OTP and authenticate
      const { data, error } = await supabase.functions.invoke("verify-login-otp", {
        body: {
          email: loginData.email,
          otp: otpString,
          password: loginData.password,
        },
      });

      if (error) throw error;

      if (data?.success && data?.session) {
        // Set the session using the tokens returned
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          throw sessionError;
        }

        // Clear login data from sessionStorage
        sessionStorage.removeItem("loginData");

        toast.success("Login successful!");
        
        // Redirect to home page (Index will handle role-based routing)
        navigate("/");
      } else {
        throw new Error(data?.error || "Verification failed");
      }
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      const errorMessage = error.message || "Failed to verify OTP";
      
      if (errorMessage.includes("Invalid OTP") || errorMessage.includes("OTP Mismatch")) {
        setOtpError("Invalid OTP. Please try again.");
      } else if (errorMessage.includes("expired")) {
        setOtpError("OTP has expired. Please request a new one.");
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

  if (!loginData) {
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
            Verify Your Login
          </CardTitle>
          <CardDescription className="text-center">
            We've sent a 6-digit OTP to {loginData.email}
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
                "Verify & Login"
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

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                sessionStorage.removeItem("loginData");
                navigate("/auth");
              }}
            >
              Back to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyLoginOTP;

