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

  console.log("verify-login-otp called:", req.method, req.url);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid request format",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { email, otp, password } = requestBody;
    console.log("Received verification request for email:", email);

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
      console.log(`❌ Invalid OTP provided for ${email}`);
      
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
        console.log(`Updated attempt count for OTP ${recentOtp.id}`);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid OTP. Please try again.",
          message: "The OTP code you entered is incorrect.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`✓ OTP record found for ${email}, checking expiration...`);

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

    console.log(`✓ OTP verified for ${email}, authenticating user...`);

    // Normalize email (lowercase and trim)
    const normalizedEmail = email.toLowerCase().trim();

    // Create a client without service role key for password verification
    // Use anon key to validate credentials (this will work correctly)
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Verify credentials and get session
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (authError) {
      console.error("❌ Authentication error:", authError);
      
      // Provide more specific error messages
      let errorMessage = "Invalid credentials. Please try logging in again.";
      if (authError.message.includes("Invalid login credentials")) {
        errorMessage = "Invalid email or password. Please try again.";
      } else if (authError.message.includes("Email not confirmed")) {
        errorMessage = "Please verify your email before logging in.";
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          details: authError.message,
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!authData.session || !authData.user) {
      console.error("❌ No session or user returned from authentication");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create session. Please try again.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`✓ Authentication successful for ${email}`);

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

