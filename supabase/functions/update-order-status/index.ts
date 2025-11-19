import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateStatusRequest {
  orderId: string;
  newStatus: string;
  notes?: string;
}

const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

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
    const { orderId, newStatus, notes }: UpdateStatusRequest = await req.json();

    // Validate input
    if (!orderId || !newStatus) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: orderId, newStatus' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validStatuses.includes(newStatus)) {
      return new Response(
        JSON.stringify({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is seller for this order
    const { data: orderData, error: orderError } = await supabaseClient
      .from('orders')
      .select(`
        id,
        status,
        order_items!inner(
          product:products!inner(seller_id)
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !orderData) {
      console.error('Order verification failed:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is a seller for any product in this order
    const isSeller = orderData.order_items.some(
      (item: any) => item.product?.seller_id === user.id
    );

    if (!isSeller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized to update this order' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update order status
    // The trigger will automatically log the status change to order_status_history
    const { data: updatedOrder, error: updateError } = await supabaseClient
      .from('orders')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Optionally add notes to the status history
    if (notes) {
      const { error: historyError } = await supabaseClient
        .from('order_status_history')
        .update({ notes })
        .eq('order_id', orderId)
        .eq('new_status', newStatus)
        .order('created_at', { ascending: false })
        .limit(1);

      if (historyError) {
        console.error('Failed to add notes to history:', historyError);
      }
    }

    console.log('Order status updated successfully:', updatedOrder);

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedOrder,
        message: `Order status updated to ${newStatus}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in update-order-status function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
