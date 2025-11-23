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
    // Parse parameters from either POST body or URL query string
    let productId: string | null;
    let page: number;
    let limit: number;

    if (req.method === 'POST') {
      const body = await req.json();
      productId = body.productId || null;
      page = parseInt(body.page || '1');
      limit = parseInt(body.limit || '10');
    } else {
      const url = new URL(req.url);
      productId = url.searchParams.get('productId');
      page = parseInt(url.searchParams.get('page') || '1');
      limit = parseInt(url.searchParams.get('limit') || '10');
    }

    if (!productId) {
      return new Response(
        JSON.stringify({ error: 'productId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client (no auth required for reading reviews)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get product rating summary
    const { data: ratingSummary, error: ratingError } = await supabaseClient
      .rpc('get_product_rating', { product_uuid: productId })
      .single();

    if (ratingError) {
      console.error('Error fetching rating summary:', ratingError);
    }

    const avgRating = (ratingSummary as any)?.average_rating || 0;
    const totalReviews = (ratingSummary as any)?.total_reviews || 0;

    // Calculate pagination
    const offset = (page - 1) * limit;

    // Get paginated reviews with user info and verified buyer flag
    const { data: reviews, error: reviewsError, count } = await supabaseClient
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        created_at,
        edited_at,
        user_id,
        verified_buyer,
        products!inner(seller_id),
        profiles(full_name)
      `, { count: 'exact' })
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (reviewsError) throw reviewsError;

    // Format reviews
    const formattedReviews = reviews?.map((review: any) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      customerName: review.profiles?.full_name || 'Anonymous',
      createdAt: review.created_at,
      editedAt: review.edited_at,
      isEdited: !!review.edited_at,
      verified_buyer: review.verified_buyer || false,
      product_seller_id: review.products?.seller_id || null,
    })) || [];

    // Calculate total pages
    const totalPages = count ? Math.ceil(count / limit) : 0;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          reviews: formattedReviews,
          summary: {
            averageRating: avgRating,
            totalReviews: totalReviews,
          },
          pagination: {
            currentPage: page,
            totalPages,
            totalItems: count || 0,
            itemsPerPage: limit,
          },
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in get-product-feedback function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
