import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse URL parameters
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client (using service role for this operation)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify token
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('delivery_confirmation_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single();

    if (tokenError || !tokenData) {
      console.error('Token verification failed:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token has expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Token has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get order details
    const { data: orderData, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, status, customer_id')
      .eq('id', tokenData.order_id)
      .single();

    if (orderError || !orderData) {
      console.error('Order not found:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if order is already delivered
    if (orderData.status === 'delivered') {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Order already marked as delivered',
          alreadyDelivered: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update order status to delivered
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        status: 'delivered',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tokenData.order_id);

    if (updateError) throw updateError;

    // Mark token as used
    const { error: tokenUpdateError } = await supabaseClient
      .from('delivery_confirmation_tokens')
      .update({
        used: true,
        used_at: new Date().toISOString(),
      })
      .eq('id', tokenData.id);

    if (tokenUpdateError) {
      console.error('Failed to mark token as used:', tokenUpdateError);
    }

    console.log('Delivery confirmed successfully for order:', tokenData.order_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Delivery confirmed successfully',
        orderId: tokenData.order_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in confirm-delivery function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
