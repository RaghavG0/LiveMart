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

    // Parse URL parameters
    const url = new URL(req.url);
    const retailerId = url.searchParams.get('retailerId') || user.id;
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    // Get retailer feedback summary
    const { data: summary, error: summaryError } = await supabaseClient
      .rpc('get_retailer_feedback_summary', { retailer_uuid: retailerId })
      .maybeSingle();

    if (summaryError) {
      console.error('Error fetching summary:', summaryError);
    }

    const totalReviewsCount = (summary as any)?.total_reviews || 0;
    const avgRating = (summary as any)?.average_rating || 0;

    // Calculate pagination
    const offset = (page - 1) * limit;

    // Get detailed feedback for retailer's products
    const { data: reviews, error: reviewsError, count } = await supabaseClient
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        created_at,
        edited_at,
        product:products!inner(
          id,
          name,
          image_url,
          seller_id
        ),
        profiles!inner(full_name)
      `, { count: 'exact' })
      .eq('product.seller_id', retailerId)
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
      product: {
        id: review.product?.id,
        name: review.product?.name,
        imageUrl: review.product?.image_url,
      },
    })) || [];

    // Calculate rating distribution
    const ratingDistribution = reviews?.reduce((acc: any, review: any) => {
      const rating = review.rating.toString();
      acc[rating] = (acc[rating] || 0) + 1;
      return acc;
    }, {}) || {};

    // Calculate total pages
    const totalPages = count ? Math.ceil(count / limit) : 0;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          reviews: formattedReviews,
          summary: {
            totalReviews: totalReviewsCount || count || 0,
            averageRating: avgRating,
            ratingDistribution,
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
    console.error('Error in get-retailer-feedback function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
