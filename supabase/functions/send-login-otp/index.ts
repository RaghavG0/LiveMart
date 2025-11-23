import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate 6-digit OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send email OTP using Gmail SMTP via Gmail API
const sendEmailOTP = async (email: string, otp: string): Promise<boolean> => {
  try {
    const GMAIL_USER = Deno.env.get("GMAIL_USER") || Deno.env.get("GMAIL_EMAIL");
    const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");
    const GMAIL_ACCESS_TOKEN = Deno.env.get("GMAIL_ACCESS_TOKEN");
    
    // HTML email content for login OTP
    const emailContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">LiveMart</h1>
          </div>
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #1f2937; margin-top: 0;">Login Verification Code</h2>
            <p style="color: #4b5563; font-size: 16px;">Your login verification code is:</p>
            <div style="font-size: 36px; font-weight: bold; color: #10b981; letter-spacing: 12px; margin: 30px 0; text-align: center; padding: 20px; background: #f0fdf4; border-radius: 8px; border: 2px dashed #10b981;">
              ${otp}
            </div>
            <p style="color: #6b7280; font-size: 14px;">This code will expire in 10 minutes.</p>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">If you didn't request this code, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;

    // Method 1: Use Gmail API with OAuth Access Token (Recommended)
    if (GMAIL_ACCESS_TOKEN) {
      try {
        const message = [
          `To: ${email}`,
          `From: ${GMAIL_USER || 'noreply@livemart.com'} <${GMAIL_USER || 'noreply@livemart.com'}>`,
          `Subject: Your LiveMart Login Verification Code`,
          `MIME-Version: 1.0`,
          `Content-Type: text/html; charset=utf-8`,
          ``,
          emailContent
        ].join('\r\n');
        
        // Gmail API requires base64url encoding
        const encodedMessage = btoa(message)
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
        
        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GMAIL_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            raw: encodedMessage,
          }),
        });
        
        if (response.ok) {
          console.log(`✓ Login OTP sent to ${email} via Gmail API`);
          return true;
        } else {
          const errorText = await response.text();
          console.error('Gmail API error:', errorText);
        }
      } catch (apiError) {
        console.error('Gmail API request failed:', apiError);
      }
    }

    // Method 2: Use EmailJS
    const EMAILJS_SERVICE_ID = Deno.env.get("EMAILJS_SERVICE_ID");
    const EMAILJS_TEMPLATE_ID = Deno.env.get("EMAILJS_TEMPLATE_ID");
    const EMAILJS_PUBLIC_KEY = Deno.env.get("EMAILJS_PUBLIC_KEY");
    
    if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
      try {
        const response = await fetch(`https://api.emailjs.com/api/v1.0/email/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            service_id: EMAILJS_SERVICE_ID,
            template_id: EMAILJS_TEMPLATE_ID,
            user_id: EMAILJS_PUBLIC_KEY,
            template_params: {
              to_email: email,
              otp_code: otp,
              message: emailContent,
            },
          }),
        });

        if (response.ok) {
          console.log(`✓ Login OTP sent to ${email} via EmailJS`);
          return true;
        }
      } catch (emailjsError) {
        console.error('EmailJS request failed:', emailjsError);
      }
    }

    // Method 3: Mock/Development fallback (log to console)
    console.log(`[MOCK] Login OTP for ${email}: ${otp}`);
    console.log(`In production, configure Gmail API or EmailJS to send real emails.`);
    return true; // Return true in development
    
  } catch (error) {
    console.error("Error sending email OTP:", error);
    return false;
  }
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("send-login-otp called:", req.method, req.url);
  console.log("Request headers:", Object.fromEntries(req.headers.entries()));

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // This function does NOT require authentication - it's for login!
    // We accept requests from unauthenticated users

    // Parse request body
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

    const { email, password } = requestBody;
    console.log("Received send-login-otp request for email:", email);

    // Validate required fields
    if (!email || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: email and password",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid email format",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // NOTE: We don't validate credentials here - we'll validate them when OTP is verified
    // This is more secure as it doesn't reveal whether an email exists
    // Credentials will be validated in verify-login-otp function
    console.log("Sending login OTP for email:", email.trim());

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Invalidate any existing unverified login OTPs for this email
    await supabase
      .from("signup_otps")
      .update({ verified: true }) // Mark as used
      .eq("email", email)
      .eq("otp_type", "login")
      .eq("verified", false);

    // Store OTP in database with type "login"
    // Note: We're reusing signup_otps table but with otp_type="login"
    // Using service role bypasses RLS policies
    console.log("Inserting OTP into database...");
    const { data: otpData, error: insertError } = await supabase
      .from("signup_otps")
      .insert({
        email: email.trim(),
        phone: null,
        otp_code: otp,
        otp_type: "login", // Mark as login OTP
        expires_at: expiresAt.toISOString(),
        verified: false,
        attempts: 0,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error storing login OTP:", insertError);
      console.error("Insert error details:", {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
      });
      
      // Return specific error message
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to store OTP",
          details: insertError.message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    console.log("OTP stored successfully:", otpData.id);

    // Send OTP via email
    const sendSuccess = await sendEmailOTP(email, otp);

    if (!sendSuccess) {
      // Delete the OTP if sending failed
      await supabase.from("signup_otps").delete().eq("id", otpData.id);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to send OTP. Please try again.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "OTP sent to your email",
        expiresAt: expiresAt.toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-login-otp:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to send login OTP",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

