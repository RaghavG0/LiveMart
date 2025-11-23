import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { email, otp, password } = await req.json();

    // Validate required fields
    if (!email || !otp || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: email, otp, and password",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Find the login OTP record
    const { data: otpRecord, error: otpError } = await supabase
      .from("signup_otps")
      .select("*")
      .eq("email", email)
      .eq("otp_code", otp)
      .eq("otp_type", "login") // Only login OTPs
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      console.error("Error fetching login OTP:", otpError);
      throw otpError;
    }

    // Check if OTP exists
    if (!otpRecord) {
      // Increment attempts for the most recent OTP if it exists
      const { data: recentOtp } = await supabase
        .from("signup_otps")
        .select("id, attempts")
        .eq("email", email)
        .eq("otp_type", "login")
        .eq("verified", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentOtp) {
        await supabase
          .from("signup_otps")
          .update({ attempts: (recentOtp.attempts || 0) + 1 })
          .eq("id", recentOtp.id);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid OTP. Please try again.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if OTP is expired
    const expiresAt = new Date(otpRecord.expires_at);
    if (expiresAt < new Date()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "OTP has expired. Please request a new one.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check max attempts (prevent brute force)
    if (otpRecord.attempts >= 5) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Too many failed attempts. Please request a new OTP.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Mark OTP as verified
    await supabase
      .from("signup_otps")
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq("id", otpRecord.id);

    // Verify credentials again before authenticating
    // This ensures the password is still correct (in case user changed it)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid credentials. Please try logging in again.",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!authData.session || !authData.user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create session",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Return session data - frontend will handle setting the session
    return new Response(
      JSON.stringify({
        success: true,
        message: "Login successful!",
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_in: authData.session.expires_in,
          expires_at: authData.session.expires_at,
          token_type: authData.session.token_type,
        },
        user: {
          id: authData.user.id,
          email: authData.user.email,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error verifying login OTP:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to verify OTP and authenticate",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

