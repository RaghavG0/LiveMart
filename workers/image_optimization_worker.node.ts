// Image Optimization Worker - Node.js Version
// Processes image_optimization_queue: generates thumbnails, compressed, and WebP versions

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const STORAGE_BUCKET = process.env.UPLOAD_STORAGE_BUCKET || "uploads";

// Production image processing functions using sharp
async function generateThumbnail(originalUrl: string, width: number, height: number): Promise<Buffer> {
  console.log(`Generating thumbnail for ${originalUrl} (${width}x${height})`);
  
  const response = await fetch(originalUrl);
  if (!response.ok) throw new Error("Failed to fetch original image");
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  return await sharp(buffer)
    .resize(width, height, { 
      fit: 'cover', 
      position: 'centre' 
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}

async function compressImage(originalUrl: string, quality: number): Promise<Buffer> {
  console.log(`Compressing ${originalUrl} at quality ${quality}`);
  
  const response = await fetch(originalUrl);
  if (!response.ok) throw new Error("Failed to fetch original image");
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  return await sharp(buffer)
    .jpeg({ quality })
    .toBuffer();
}

async function convertToWebP(originalUrl: string): Promise<Buffer> {
  console.log(`Converting ${originalUrl} to WebP`);
  
  const response = await fetch(originalUrl);
  if (!response.ok) throw new Error("Failed to fetch original image");
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  return await sharp(buffer)
    .webp({ quality: 85 })
    .toBuffer();
}

async function uploadToStorage(bucket: string, path: string, buffer: Buffer, contentType: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType, upsert: true });
  
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  
  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicData.publicUrl;
}

async function processImage(job: any): Promise<void> {
  console.log(`Processing image ${job.image_id}`);
  
  try {
    const originalUrl = job.original_url;
    
    // Fetch config for thumbnail dimensions and quality
    const { data: configData } = await supabase
      .from('image_upload_config')
      .select('key, value')
      .in('key', ['thumbnail_dimensions', 'compressed_quality']);
    
    const config = Object.fromEntries(
      (configData || []).map((c: any) => [c.key, c.value])
    );
    
    const thumbDims = config.thumbnail_dimensions || { width: 200, height: 200 };
    const compressQuality = config.compressed_quality || 80;
    
    // Generate variants
    const [thumbnail, compressed, webp] = await Promise.all([
      generateThumbnail(originalUrl, thumbDims.width, thumbDims.height),
      compressImage(originalUrl, compressQuality),
      convertToWebP(originalUrl)
    ]);
    
    // Extract base path from storage path
    const storagePath = job.storage_path;
    const basePath = storagePath.replace(/\.[^.]+$/, ''); // Remove extension
    
    // Upload variants
    const [thumbnailUrl, compressedUrl, webpUrl] = await Promise.all([
      uploadToStorage(STORAGE_BUCKET, `${basePath}_thumb.jpg`, thumbnail, 'image/jpeg'),
      uploadToStorage(STORAGE_BUCKET, `${basePath}_compressed.jpg`, compressed, 'image/jpeg'),
      uploadToStorage(STORAGE_BUCKET, `${basePath}.webp`, webp, 'image/webp')
    ]);
    
    // Mark as successful
    await supabase.rpc('mark_optimization_result', {
      p_queue_id: job.queue_id,
      p_success: true,
      p_thumbnail_url: thumbnailUrl,
      p_compressed_url: compressedUrl,
      p_webp_url: webpUrl,
      p_error_message: null
    });
    
    console.log(`Successfully processed image ${job.image_id}`);
  } catch (error: any) {
    console.error(`Failed to process image ${job.image_id}:`, error);
    
    // Mark as failed (triggers retry logic)
    await supabase.rpc('mark_optimization_result', {
      p_queue_id: job.queue_id,
      p_success: false,
      p_thumbnail_url: null,
      p_compressed_url: null,
      p_webp_url: null,
      p_error_message: error.message
    });
  }
}

async function runBatch(): Promise<void> {
  const { data: jobs, error } = await supabase.rpc('get_pending_optimization_jobs', { 
    p_limit: 5 
  });
  
  if (error) {
    console.error('Error fetching jobs:', error);
    return;
  }
  
  if (!jobs || jobs.length === 0) {
    console.log('No pending jobs');
    return;
  }
  
  console.log(`Processing ${jobs.length} jobs`);
  
  for (const job of jobs) {
    await processImage(job);
  }
}

async function main() {
  console.log('Image Optimization Worker (Node.js) started');
  console.log('Storage bucket:', STORAGE_BUCKET);
  
  const continuous = process.env.IMAGE_OPTIMIZATION_CONTINUOUS === 'true';
  const interval = parseInt(process.env.IMAGE_OPTIMIZATION_INTERVAL_MS || '60000');
  
  if (continuous) {
    console.log(`Running in continuous mode (interval: ${interval}ms)`);
    
    // Run once immediately
    await runBatch();
    
    // Then run on interval
    setInterval(async () => {
      await runBatch();
    }, interval);
  } else {
    console.log('Running once');
    await runBatch();
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
