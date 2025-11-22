import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SubscribeRequest {
  email: string;
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validate email format
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

// Send welcome email using Resend email service
async function sendWelcomeEmail(email: string, supabaseClient: any): Promise<boolean> {
  try {
    const emailSubject = "Welcome to LiveMart - You're Subscribed!";
    const emailBody = `
Hi there,

You are now successfully subscribed to LiveMart!

You will receive all the latest updates, special offers, new product alerts, and fresh recipes delivered directly to your inbox.

To cancel your subscription at any time, simply reply to this email with the word "UNSUBSCRIBE" in the subject or body.

Thank you for joining the LiveMart community!

Best regards,
The LiveMart Team
    `.trim();

    // Get Resend API key from environment variables
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    if (!RESEND_API_KEY) {
      console.warn('[Email Service] RESEND_API_KEY not found. Email sending is disabled.');
      console.warn('[Email Service] To enable email sending:');
      console.warn('[Email Service] 1. Create account at https://resend.com');
      console.warn('[Email Service] 2. Get API key from Resend dashboard');
      console.warn('[Email Service] 3. Add to Supabase secrets: supabase secrets set RESEND_API_KEY=your_key');
      console.warn('[Email Service] Subscription will proceed, but welcome email will not be sent.');
      return true; // Don't fail subscription if email service is not configured
    }

    // Send email via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Use your verified domain or Resend test domain for development
        // For production: replace with your verified domain (e.g., noreply@livemart.com)
        // For testing: use Resend's test domain
        from: 'LiveMart <onboarding@resend.dev>', // Change to your verified domain in production
        to: [email],
        subject: emailSubject,
        text: emailBody,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Email Service] Failed to send email via Resend:', response.status, errorText);
      
      // Try to parse error for better logging
      try {
        const errorJson = JSON.parse(errorText);
        console.error('[Email Service] Resend error details:', errorJson);
      } catch {
        // Ignore JSON parse errors
      }
      
      // Don't fail subscription if email fails - log and continue
      return true;
    }

    const result = await response.json();
    console.log(`[Email Service] Email sent successfully via Resend to ${email}. ID: ${result.id}`);
    
    return true;
  } catch (error) {
    console.error('[Email Service] Error sending welcome email:', error);
    // Don't fail the subscription if email sending fails
    // Email delivery issues shouldn't prevent users from subscribing
    return true;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const { email }: SubscribeRequest = await req.json();

    // Server-side validation
    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if email already exists
    const { data: existingSubscriber, error: checkError } = await supabaseClient
      .from('subscribers')
      .select('id, email, is_active')
      .eq('email', normalizedEmail)
      .maybeSingle(); // Use maybeSingle() instead of single() to handle no rows gracefully

    if (checkError) {
      // Log the full error for debugging
      console.error('Error checking existing subscriber:', JSON.stringify(checkError, null, 2));
      
      // Check if the table doesn't exist
      if (checkError.code === '42P01' || checkError.message?.includes('relation') || checkError.message?.includes('does not exist')) {
        return new Response(
          JSON.stringify({ 
            error: 'Database table not found. Please run the migration to create the subscribers table.',
            details: 'Run: supabase db push or apply migration 20251121120000_create_subscribers_table.sql'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to check subscription status',
          details: checkError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If subscriber exists and is active
    if (existingSubscriber && existingSubscriber.is_active) {
      return new Response(
        JSON.stringify({ 
          message: 'You are already subscribed!',
          already_subscribed: true 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If subscriber exists but is unsubscribed, reactivate them
    if (existingSubscriber && !existingSubscriber.is_active) {
      const { error: updateError } = await supabaseClient
        .from('subscribers')
        .update({ 
          is_active: true,
          subscribed_at: new Date().toISOString(),
          unsubscribed_at: null
        })
        .eq('id', existingSubscriber.id);

      if (updateError) {
        console.error('Error reactivating subscriber:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to reactivate subscription' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Send welcome email (even for reactivations)
      await sendWelcomeEmail(normalizedEmail, supabaseClient);

      return new Response(
        JSON.stringify({ 
          message: 'Successfully resubscribed! Welcome back!',
          email: normalizedEmail 
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // New subscriber - insert into database
    const { data: newSubscriber, error: insertError } = await supabaseClient
      .from('subscribers')
      .insert({
        email: normalizedEmail,
        is_active: true,
        subscribed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting subscriber:', JSON.stringify(insertError, null, 2));
      
      // Handle unique constraint violation (race condition)
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({ 
            message: 'You are already subscribed!',
            already_subscribed: true 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if the table doesn't exist
      if (insertError.code === '42P01' || insertError.message?.includes('relation') || insertError.message?.includes('does not exist')) {
        return new Response(
          JSON.stringify({ 
            error: 'Database table not found. Please run the migration to create the subscribers table.',
            details: 'Run: supabase db push or apply migration 20251121120000_create_subscribers_table.sql'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          error: 'Failed to create subscription',
          details: insertError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send welcome email to new subscriber
    const emailSent = await sendWelcomeEmail(normalizedEmail, supabaseClient);
    
    if (!emailSent) {
      // Log warning but don't fail the subscription
      console.warn('Warning: Failed to send welcome email, but subscription was created');
    }

    console.log('Successfully subscribed email:', normalizedEmail);

    return new Response(
      JSON.stringify({ 
        message: 'Successfully subscribed!',
        email: normalizedEmail 
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in subscribe-email function:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.stack || 'An unexpected error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

