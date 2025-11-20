// Image Optimization Worker
// Processes image_optimization_queue: generates thumbnails, compressed, and WebP versions
// Production implementation using sharp library for image processing

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import sharp from "sharp";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const STORAGE_BUCKET = Deno.env.get("UPLOAD_STORAGE_BUCKET") || "uploads";

// Production image processing functions using sharp
async function generateThumbnail(originalUrl: string, width: number, height: number): Promise<Blob> {
  console.log(`Generating thumbnail for ${originalUrl} (${width}x${height})`);
  
  const response = await fetch(originalUrl);
  if (!response.ok) throw new Error("Failed to fetch original image");
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  const processed = await sharp(buffer)
    .resize(width, height, { 
      fit: 'cover', 
      position: 'centre' 
    })
    .jpeg({ quality: 85 })
    .toBuffer();
  
  return new Blob([new Uint8Array(processed)], { type: 'image/jpeg' });
}

async function compressImage(originalUrl: string, quality: number): Promise<Blob> {
  console.log(`Compressing ${originalUrl} at quality ${quality}`);
  
  const response = await fetch(originalUrl);
  if (!response.ok) throw new Error("Failed to fetch original image");
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  const processed = await sharp(buffer)
    .jpeg({ quality })
    .toBuffer();
  
  return new Blob([new Uint8Array(processed)], { type: 'image/jpeg' });
}

async function convertToWebP(originalUrl: string): Promise<Blob> {
  console.log(`Converting ${originalUrl} to WebP`);
  
  const response = await fetch(originalUrl);
  if (!response.ok) throw new Error("Failed to fetch original image");
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  const processed = await sharp(buffer)
    .webp({ quality: 85 })
    .toBuffer();
  
  return new Blob([new Uint8Array(processed)], { type: 'image/webp' });
}

async function uploadToStorage(bucket: string, path: string, blob: Blob, contentType: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType, upsert: true });
  
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  
  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicData.publicUrl;
}

async function processImage(job: any) {
  const { queue_id, image_id, original_url, mime_type } = job;
  
  try {
    console.log(`Processing image ${image_id}`);
    
    // Get config
    const { data: configData } = await supabase
      .from("image_upload_config")
      .select("key, value")
      .in("key", ["thumbnail_dimensions", "compressed_quality"]);
    
    const config = (configData || []).reduce((acc: any, c: any) => {
      acc[c.key] = c.value;
      return acc;
    }, {});
    
    const thumbDims = config.thumbnail_dimensions || { width: 200, height: 200 };
    const compressQuality = config.compressed_quality || 80;
    
    // Generate variants
    const thumbnailBlob = await generateThumbnail(original_url, thumbDims.width, thumbDims.height);
    const compressedBlob = await compressImage(original_url, compressQuality);
    const webpBlob = await convertToWebP(original_url);
    
    // Upload variants
    const basePath = original_url.split("/").slice(-2).join("/").replace(/\.[^.]+$/, "");
    const thumbnailPath = `${basePath}_thumb.jpg`;
    const compressedPath = `${basePath}_compressed.jpg`;
    const webpPath = `${basePath}.webp`;
    
    const thumbnailUrl = await uploadToStorage(STORAGE_BUCKET, thumbnailPath, thumbnailBlob, "image/jpeg");
    const compressedUrl = await uploadToStorage(STORAGE_BUCKET, compressedPath, compressedBlob, "image/jpeg");
    const webpUrl = await uploadToStorage(STORAGE_BUCKET, webpPath, webpBlob, "image/webp");
    
    // Mark success
    await supabase.rpc("mark_optimization_result", {
      p_queue_id: queue_id,
      p_success: true,
      p_thumbnail_url: thumbnailUrl,
      p_compressed_url: compressedUrl,
      p_webp_url: webpUrl,
    });
    
    console.log(`Successfully optimized image ${image_id}`);
  } catch (err) {
    console.error(`Optimization failed for ${image_id}:`, err);
    await supabase.rpc("mark_optimization_result", {
      p_queue_id: queue_id,
      p_success: false,
      p_error_message: err.message || "Unknown error",
    });
  }
}

async function runBatch(limit = 5) {
  const { data: jobs, error } = await supabase.rpc("get_pending_optimization_jobs", { p_limit: limit });
  
  if (error) {
    console.error("Failed to fetch jobs:", error);
    return;
  }
  
  if (!jobs || jobs.length === 0) {
    console.log("No pending optimization jobs");
    return;
  }
  
  console.log(`Processing ${jobs.length} optimization jobs`);
  
  for (const job of jobs) {
    await processImage(job);
  }
}

if (import.meta.main) {
  const intervalMs = parseInt(Deno.env.get("IMAGE_OPTIMIZATION_INTERVAL_MS") || "60000");
  console.log("Image optimization worker started");
  
  await runBatch();
  
  if (Deno.env.get("IMAGE_OPTIMIZATION_CONTINUOUS") === "true") {
    setInterval(() => { runBatch(); }, intervalMs);
  }
}
