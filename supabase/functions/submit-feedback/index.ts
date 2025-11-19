import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeedbackRequest {
  productId: string;
  orderId: string;
  rating: number;
  comment?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with user's auth token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { productId, orderId, rating, comment }: FeedbackRequest = await req.json();

    // Validate input
    if (!productId || !orderId || !rating) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: productId, orderId, rating' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (rating < 1 || rating > 5) {
      return new Response(
        JSON.stringify({ error: 'Rating must be between 1 and 5' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify order belongs to user and contains the product
    const { data: orderData, error: orderError } = await supabaseClient
      .from('orders')
      .select(`
        id,
        customer_id,
        status,
        order_items!inner(product_id)
      `)
      .eq('id', orderId)
      .eq('customer_id', user.id)
      .eq('order_items.product_id', productId)
      .single();

    if (orderError || !orderData) {
      console.error('Order verification failed:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found or does not contain this product' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if order is delivered
    if (orderData.status !== 'delivered') {
      return new Response(
        JSON.stringify({ error: 'Can only review products from delivered orders' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if feedback already exists
    const { data: existingReview } = await supabaseClient
      .from('reviews')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .eq('order_id', orderId)
      .maybeSingle();

    let result;
    
    if (existingReview) {
      // Update existing review
      const { data, error } = await supabaseClient
        .from('reviews')
        .update({
          rating,
          comment: comment || null,
          edited_at: new Date().toISOString(),
        })
        .eq('id', existingReview.id)
        .select()
        .single();

      if (error) throw error;
      result = { ...data, updated: true };
    } else {
      // Create new review
      const { data, error } = await supabaseClient
        .from('reviews')
        .insert({
          user_id: user.id,
          product_id: productId,
          order_id: orderId,
          rating,
          comment: comment || null,
        })
        .select()
        .single();

      if (error) throw error;
      result = { ...data, updated: false };
    }

    console.log('Feedback submitted successfully:', result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result,
        message: existingReview ? 'Feedback updated successfully' : 'Feedback submitted successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in submit-feedback function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
