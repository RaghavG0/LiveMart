// Image Cleanup Worker - Node.js Version
// Purges unreferenced images older than configurable threshold

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const STORAGE_BUCKET = process.env.UPLOAD_STORAGE_BUCKET || "uploads";

function extractStoragePath(url: string): string | null {
  // Extract path from Supabase Storage URL
  // Format: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
  const match = url.match(/\/object\/public\/[^/]+\/(.+)$/);
  return match ? match[1] : null;
}

async function deleteFromStorage(urls: string[]): Promise<void> {
  const paths = urls
    .map(url => extractStoragePath(url))
    .filter((path): path is string => path !== null);
  
  if (paths.length === 0) return;
  
  console.log(`Deleting ${paths.length} files from storage`);
  
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove(paths);
  
  if (error) {
    console.error('Storage deletion error:', error);
    throw error;
  }
}

async function runCleanup(): Promise<void> {
  console.log('Starting cleanup...');
  
  // Fetch cleanup threshold from config
  const { data: configData } = await supabase
    .from('image_upload_config')
    .select('value')
    .eq('key', 'cleanup_days_threshold')
    .maybeSingle();
  
  const daysThreshold = configData?.value || 7;
  console.log(`Using threshold: ${daysThreshold} days`);
  
  // Get unreferenced images
  const { data: images, error } = await supabase.rpc('get_unreferenced_images', {
    p_days_threshold: daysThreshold
  });
  
  if (error) {
    console.error('Error fetching unreferenced images:', error);
    throw error;
  }
  
  if (!images || images.length === 0) {
    console.log('No unreferenced images to clean up');
    return;
  }
  
  console.log(`Found ${images.length} unreferenced images to clean up`);
  
  for (const image of images) {
    try {
      console.log(`Cleaning up image ${image.id} (${image.original_filename})`);
      
      // Collect all URLs for this image
      const urls = [
        image.original_url,
        image.thumbnail_url,
        image.compressed_url,
        image.webp_url
      ].filter(url => url !== null);
      
      // Delete from storage
      await deleteFromStorage(urls);
      
      // Delete database record
      await supabase.rpc('delete_image_upload', {
        p_image_id: image.id
      });
      
      console.log(`Successfully cleaned up image ${image.id}`);
    } catch (error) {
      console.error(`Failed to clean up image ${image.id}:`, error);
      // Continue with other images
    }
  }
  
  console.log('Cleanup completed');
}

async function main() {
  console.log('Image Cleanup Worker (Node.js) started');
  console.log('Storage bucket:', STORAGE_BUCKET);
  
  const continuous = process.env.IMAGE_CLEANUP_CONTINUOUS === 'true';
  const interval = parseInt(process.env.IMAGE_CLEANUP_INTERVAL_MS || '86400000'); // 24 hours
  
  if (continuous) {
    console.log(`Running in continuous mode (interval: ${interval}ms)`);
    
    // Run once immediately
    await runCleanup();
    
    // Then run on interval
    setInterval(async () => {
      await runCleanup();
    }, interval);
  } else {
    console.log('Running once');
    await runCleanup();
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
