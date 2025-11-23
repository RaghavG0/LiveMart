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

// Exchange refresh token for access token
const getAccessTokenFromRefreshToken = async (): Promise<string | null> => {
  try {
    const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID");
    const GMAIL_CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET");
    const GMAIL_REFRESH_TOKEN = Deno.env.get("GMAIL_REFRESH_TOKEN");

    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
      console.log("Missing OAuth credentials for refresh token flow");
      return null;
    }

    console.log("Exchanging refresh token for access token...");
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        refresh_token: GMAIL_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to refresh access token:', {
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const data = await response.json();
    console.log('✓ Successfully obtained access token');
    return data.access_token;
  } catch (error: any) {
    console.error('❌ Error refreshing access token:', error);
    return null;
  }
};

// Send email OTP using Gmail SMTP via Gmail API
const sendEmailOTP = async (email: string, otp: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const GMAIL_USER = Deno.env.get("GMAIL_USER") || Deno.env.get("GMAIL_EMAIL");
    const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");
    const GMAIL_ACCESS_TOKEN = Deno.env.get("GMAIL_ACCESS_TOKEN");
    const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID");
    const GMAIL_CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET");
    const GMAIL_REFRESH_TOKEN = Deno.env.get("GMAIL_REFRESH_TOKEN");
    
    console.log("Email configuration check:", {
      hasGmailUser: !!GMAIL_USER,
      hasGmailAccessToken: !!GMAIL_ACCESS_TOKEN,
      hasOAuthCredentials: !!(GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN),
      hasGmailAppPassword: !!GMAIL_APP_PASSWORD,
      hasEmailJS: !!(
        Deno.env.get("EMAILJS_SERVICE_ID") &&
        Deno.env.get("EMAILJS_TEMPLATE_ID") &&
        Deno.env.get("EMAILJS_PUBLIC_KEY")
      ),
    });
    
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

    // Method 1a: Use Gmail API with OAuth Refresh Token (Preferred - auto-refreshes)
    if (GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN) {
      try {
        // Get access token from refresh token
        const accessToken = await getAccessTokenFromRefreshToken();
        
        if (!accessToken) {
          console.error('❌ Failed to obtain access token from refresh token');
          // Don't return yet, try direct access token or other methods
        } else {
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
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              raw: encodedMessage,
            }),
          });
          
          if (response.ok) {
            const responseData = await response.json();
            console.log(`✓ Login OTP sent to ${email} via Gmail API (OAuth refresh token). Message ID: ${responseData.id}`);
            return { success: true };
          } else {
            const errorText = await response.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: errorText };
            }
            console.error('❌ Gmail API error (OAuth refresh token):', {
              status: response.status,
              statusText: response.statusText,
              error: errorData,
              rawResponse: errorText,
            });
            // Don't return yet, try direct access token or other methods
          }
        }
      } catch (apiError: any) {
        console.error('❌ Gmail API request failed (OAuth refresh token):', {
          error: apiError.message,
          stack: apiError.stack,
          name: apiError.name,
        });
        // Don't return yet, try direct access token or other methods
      }
    }

    // Method 1b: Use Gmail API with Direct Access Token (Fallback)
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
          const responseData = await response.json();
          console.log(`✓ Login OTP sent to ${email} via Gmail API (direct access token). Message ID: ${responseData.id}`);
          return { success: true };
        } else {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText };
          }
          console.error('❌ Gmail API error (direct access token):', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            rawResponse: errorText,
          });
          // Don't return yet, try next method
        }
      } catch (apiError: any) {
        console.error('❌ Gmail API request failed (direct access token):', {
          error: apiError.message,
          stack: apiError.stack,
          name: apiError.name,
        });
        // Don't return yet, try next method
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
          const responseData = await response.json();
          console.log(`✓ Login OTP sent to ${email} via EmailJS. Response:`, responseData);
          return { success: true };
        } else {
          const errorText = await response.text();
          console.error('❌ EmailJS error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          });
          // Don't return yet, try mock as last resort
        }
      } catch (emailjsError: any) {
        console.error('❌ EmailJS request failed:', {
          error: emailjsError.message,
          stack: emailjsError.stack,
          name: emailjsError.name,
        });
        // Don't return yet, try mock as last resort
      }
    }

    // Method 3: Mock/Development fallback (log to console)
    console.warn(`⚠️ [MOCK MODE] Login OTP for ${email}: ${otp}`);
    console.warn(`⚠️ No email service configured. Configure one of the following:`);
    console.warn(`   - Gmail API: Set GMAIL_USER and GMAIL_ACCESS_TOKEN environment variables`);
    console.warn(`   - EmailJS: Set EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, and EMAILJS_PUBLIC_KEY`);
    console.warn(`⚠️ Email NOT sent in production! This should only be used for development.`);
    return { 
      success: false, 
      error: "Email service not configured. OTP was not sent. Please configure Gmail API or EmailJS in production." 
    };
    
  } catch (error: any) {
    console.error("❌ Error sending email OTP:", {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });
    return { 
      success: false, 
      error: `Failed to send email: ${error.message}` 
    };
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
    const emailResult = await sendEmailOTP(email, otp);

    if (!emailResult.success) {
      // Delete the OTP if sending failed
      await supabase.from("signup_otps").delete().eq("id", otpData.id);
      
      console.error("❌ Email sending failed:", emailResult.error);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: emailResult.error || "Failed to send OTP. Please check email service configuration.",
          details: "Check Supabase Edge Function logs for email service configuration errors.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    console.log(`✓ Login OTP successfully sent to ${email}`);

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

