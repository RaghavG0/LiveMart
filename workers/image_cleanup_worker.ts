// Image Cleanup Worker
// Purges unreferenced images older than configured threshold

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const STORAGE_BUCKET = Deno.env.get("UPLOAD_STORAGE_BUCKET") || "uploads";

function extractStoragePath(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/object\/public\/[^/]+\/(.+)$/);
    return pathMatch ? pathMatch[1] : null;
  } catch {
    return null;
  }
}

async function deleteFromStorage(urls: string[]) {
  const paths = urls.map(extractStoragePath).filter(Boolean) as string[];
  
  if (paths.length === 0) return;
  
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
  
  if (error) {
    console.error("Storage deletion error:", error);
  } else {
    console.log(`Deleted ${paths.length} files from storage`);
  }
}

async function runCleanup() {
  // Get config
  const { data: configData } = await supabase
    .from("image_upload_config")
    .select("value")
    .eq("key", "cleanup_days_threshold")
    .single();
  
  const daysThreshold = configData?.value || 7;
  
  console.log(`Running cleanup for unreferenced images older than ${daysThreshold} days`);
  
  const { data: unreferencedImages, error } = await supabase.rpc(
    "get_unreferenced_images",
    { p_days_old: daysThreshold }
  );
  
  if (error) {
    console.error("Failed to fetch unreferenced images:", error);
    return;
  }
  
  if (!unreferencedImages || unreferencedImages.length === 0) {
    console.log("No unreferenced images to clean up");
    return;
  }
  
  console.log(`Found ${unreferencedImages.length} unreferenced images to delete`);
  
  for (const img of unreferencedImages) {
    try {
      // Collect all URLs
      const urls = [
        img.original_url,
        img.thumbnail_url,
        img.compressed_url,
        img.webp_url,
      ].filter(Boolean) as string[];
      
      // Delete from storage
      await deleteFromStorage(urls);
      
      // Delete database record
      await supabase.rpc("delete_image_upload", { p_image_id: img.id });
      
      console.log(`Deleted image ${img.id} (${img.original_url})`);
    } catch (err) {
      console.error(`Failed to delete image ${img.id}:`, err);
    }
  }
  
  console.log("Cleanup complete");
}

if (import.meta.main) {
  const intervalMs = parseInt(Deno.env.get("IMAGE_CLEANUP_INTERVAL_MS") || "86400000"); // Default 24h
  console.log("Image cleanup worker started");
  
  await runCleanup();
  
  if (Deno.env.get("IMAGE_CLEANUP_CONTINUOUS") === "true") {
    setInterval(() => { runCleanup(); }, intervalMs);
  }
}
