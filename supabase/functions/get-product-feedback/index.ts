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
    let productId: string | null = null;
    let page: number = 1;
    let limit: number = 10;

    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);

    if (req.method === 'POST') {
      try {
        // Check if request has body
        const contentType = req.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.warn('POST request without JSON content-type, trying to parse anyway');
        }
        
        const bodyText = await req.text();
        console.log('Raw POST body text:', bodyText);
        
        if (!bodyText || bodyText.trim() === '') {
          throw new Error('Empty request body');
        }
        
        const body = JSON.parse(bodyText);
        console.log('Parsed POST body:', body);
        productId = body.productId || body.product_id || null;
        page = parseInt(String(body.page || '1'), 10);
        limit = parseInt(String(body.limit || '10'), 10);
      } catch (parseError: any) {
        console.error('Error parsing POST body:', parseError);
        console.error('Parse error details:', parseError.message, parseError.stack);
        // Try URL params as fallback
        try {
          const url = new URL(req.url);
          productId = url.searchParams.get('productId') || url.searchParams.get('product_id');
          page = parseInt(url.searchParams.get('page') || '1', 10);
          limit = parseInt(url.searchParams.get('limit') || '10', 10);
          console.log('Falling back to URL params:', { productId, page, limit });
        } catch (urlError) {
          console.error('Error parsing URL params:', urlError);
        }
      }
    } else {
      const url = new URL(req.url);
      productId = url.searchParams.get('productId') || url.searchParams.get('product_id');
      page = parseInt(url.searchParams.get('page') || '1', 10);
      limit = parseInt(url.searchParams.get('limit') || '10', 10);
    }

    console.log('Parsed parameters:', { productId, page, limit });

    if (!productId || productId === 'null' || productId === 'undefined') {
      console.error('Missing or invalid productId in request. Received:', productId);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'productId is required',
          details: `Received productId: ${productId}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate productId is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productId)) {
      console.error('Invalid productId format:', productId);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid productId format',
          details: 'productId must be a valid UUID' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client (no auth required for reading reviews)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get product rating summary - try both function signatures
    let ratingSummary: any = null;
    try {
      const { data, error } = await supabaseClient
        .rpc('get_product_rating', { product_uuid: productId })
        .maybeSingle();
      if (!error && data) {
        ratingSummary = data;
      }
    } catch (e) {
      // Try alternative function signature
      try {
        const { data, error } = await supabaseClient
          .rpc('get_product_rating', { p_product_id: productId })
          .maybeSingle();
        if (!error && data) {
          ratingSummary = data;
        }
      } catch (e2) {
        console.error('Error fetching rating summary:', e2);
      }
    }

    // Calculate rating directly from reviews if RPC fails
    let avgRating = 0;
    let totalReviews = 0;
    
    if (ratingSummary) {
      avgRating = parseFloat(ratingSummary.average_rating || ratingSummary.avg_rating || 0);
      totalReviews = parseInt(ratingSummary.total_reviews || ratingSummary.review_count || 0);
    } else {
      // Fallback: calculate directly from reviews
      const { data: reviewData } = await supabaseClient
        .from('reviews')
        .select('rating', { count: 'exact' })
        .eq('product_id', productId);
      
      if (reviewData && reviewData.length > 0) {
        totalReviews = reviewData.length;
        const sum = reviewData.reduce((acc, r) => acc + (r.rating || 0), 0);
        avgRating = totalReviews > 0 ? sum / totalReviews : 0;
      }
    }

    // Calculate pagination
    const offset = (page - 1) * limit;

    // Get paginated reviews - use simpler query without complex joins
    console.log('Fetching reviews for productId:', productId, 'offset:', offset, 'limit:', limit);
    
    const { data: reviewsData, error: reviewsError, count: reviewsCount } = await supabaseClient
      .from('reviews')
      .select('id, rating, comment, created_at, edited_at, user_id, verified_buyer, product_id', { count: 'exact' })
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (reviewsError) {
      console.error('Error fetching reviews:', reviewsError);
      console.error('Reviews error details:', {
        message: reviewsError.message,
        details: reviewsError.details,
        hint: reviewsError.hint,
        code: reviewsError.code,
      });
      
      // Return error response instead of throwing
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch reviews',
          details: reviewsError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Reviews fetched:', reviewsData?.length || 0, 'Total count:', reviewsCount);

    let reviews: any[] = [];
    const count = reviewsCount || 0;
    
    // Enrich with profile data
    if (reviewsData && reviewsData.length > 0) {
      const userIds = [...new Set(reviewsData.map((r: any) => r.user_id).filter(Boolean))];
      
      // Fetch profiles
      let profilesMap = new Map();
      if (userIds.length > 0) {
        const { data: profilesData } = await supabaseClient
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        
        if (profilesData) {
          profilesMap = new Map(profilesData.map((p: any) => [p.id, p]));
        }
      }
      
      // Get product seller_id
      let sellerId: string | null = null;
      try {
        const { data: productData } = await supabaseClient
          .from('products')
          .select('seller_id')
          .eq('id', productId)
          .maybeSingle();
        sellerId = productData?.seller_id || null;
      } catch (productError) {
        console.error('Error fetching product seller_id:', productError);
      }
      
      reviews = reviewsData.map((r: any) => ({
        ...r,
        profiles: profilesMap.get(r.user_id) || { full_name: 'Anonymous' },
        products: { seller_id: sellerId }
      }));
    }

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
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
