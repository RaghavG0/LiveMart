// Search index worker: consumes search_index_queue and syncs with Elastic/Algolia
// Configure via env: SEARCH_PROVIDER (elastic|algolia|stub), provider keys/urls.

// Pin version & include types
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.43.4?dts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PROVIDER = Deno.env.get('SEARCH_PROVIDER') || 'stub';
const INDEX_NAME = Deno.env.get('SEARCH_INDEX_NAME') || 'reviews';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function providerUpsert(doc: any) {
  if (PROVIDER === 'stub') return { ok: true };
  // Implement real provider calls here
  return { ok: true };
}
async function providerDelete(reviewId: string) {
  if (PROVIDER === 'stub') return { ok: true };
  return { ok: true };
}

async function runBatch(limit = 50) {
  const { data, error } = await supabase
    .from('search_index_queue')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('fetch queue error', error);
    return;
  }
  if (!data || data.length === 0) return;
  for (const item of data) {
    try {
      if (item.op === 'upsert') {
        await providerUpsert({
          index: INDEX_NAME,
          productId: item.product_id,
          reviewId: item.review_id,
          ...item.payload,
        });
      } else if (item.op === 'delete') {
        await providerDelete(item.review_id);
      }
    } catch (err) {
      console.error('provider op failed', err);
      continue;
    } finally {
      await supabase.from('search_index_queue').delete().eq('id', item.id);
    }
  }
}

if (import.meta.main) {
  const intervalMs = parseInt(Deno.env.get('SEARCH_WORKER_INTERVAL_MS') || '60000');
  await runBatch();
  if (Deno.env.get('SEARCH_WORKER_CONTINUOUS') === 'true') {
    setInterval(() => { runBatch(); }, intervalMs);
  }
}
