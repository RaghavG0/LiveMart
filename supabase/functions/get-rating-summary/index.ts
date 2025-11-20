import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lightweight Redis client via Upstash REST API or native Redis connection isn't supported in Deno by default here.
// We'll expect a REST endpoint env var for cache (optional), otherwise fallback to DB.

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const url = new URL(req.url);
    const productId = url.pathname.split("/").filter(Boolean).pop();
    if (!productId) return new Response(JSON.stringify({ error: "Missing product id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || undefined;
    const supabase = createClient(supabaseUrl, supabaseKey, authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined);

    const cacheUrl = Deno.env.get("RATING_CACHE_URL"); // optional custom cache service endpoint
    const cacheTtl = parseInt(Deno.env.get("RATING_CACHE_TTL_SEC") || "300");

    // Try cache first if configured
    if (cacheUrl) {
      try {
        const cResp = await fetch(`${cacheUrl}/get/${productId}`);
        if (cResp.ok) {
          const cached = await cResp.json();
          if (cached && cached.value) {
            return new Response(cached.value, { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" } });
          }
        }
      } catch (_) {}
    }

    // DB fallback
    const { data, error } = await supabase
      .from('product_rating_summary')
      .select('*')
      .eq('product_id', productId)
      .single();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const payload = JSON.stringify(data || { product_id: productId, review_count: 0, avg_rating: 0, pct_1star: 0, pct_2star: 0, pct_3star: 0, pct_4star: 0, pct_5star: 0 });

    // Write to cache
    if (cacheUrl) {
      try {
        await fetch(`${cacheUrl}/set/${productId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: payload, ttl: cacheTtl }) });
      } catch (_) {}
    }

    return new Response(payload, { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" } });
  } catch (err) {
    console.error('get-rating-summary error', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
