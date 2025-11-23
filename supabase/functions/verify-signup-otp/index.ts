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

    const { email, otp, password, fullName, phone, role, locationAddress, locationLat, locationLng } = await req.json();

    // Validate required fields
    if (!email || !otp || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: email, otp, password",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Find the OTP record
    const { data: otpRecord, error: otpError } = await supabase
      .from("signup_otps")
      .select("*")
      .eq("email", email)
      .eq("otp_code", otp)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      console.error("Error fetching OTP:", otpError);
      throw otpError;
    }

    // Check if OTP exists
    if (!otpRecord) {
      // Increment attempts for the most recent OTP if it exists
      const { data: recentOtp } = await supabase
        .from("signup_otps")
        .select("id, attempts")
        .eq("email", email)
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
          error: "OTP Mismatch, please try again.",
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

    // Check if user already exists (double-check)
    try {
      const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email);
      if (existingUser?.user) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Account already exists. Please login instead.",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    } catch (checkError: any) {
      // If error checking, continue - user creation will fail if account exists
      console.log("User existence check inconclusive, proceeding with account creation");
    }

    // Create the user account
    const redirectUrl = `${Deno.env.get("SITE_URL") || "http://localhost:5173"}/`;
    
    const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email since OTP is verified
      user_metadata: {
        full_name: fullName || email.split("@")[0],
        phone: phone || null,
        role: role || "customer",
        location_address: locationAddress || null,
        location_lat: locationLat || null,
        location_lng: locationLng || null,
      },
    });

    if (signUpError) {
      console.error("Error creating user:", signUpError);
      throw signUpError;
    }

    if (!authData.user) {
      throw new Error("Failed to create user account");
    }

    // The handle_new_user trigger will automatically create the profile
    // Wait a moment for the trigger to execute
    await new Promise((resolve) => setTimeout(resolve, 500));

    return new Response(
      JSON.stringify({
        success: true,
        message: "Account created successfully!",
        userId: authData.user.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error verifying OTP:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to verify OTP and create account",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

