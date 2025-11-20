import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const uploadType = url.searchParams.get("type") || "feedback_image";
    const filename = url.searchParams.get("filename") || "upload.jpg";
    const mimeType = url.searchParams.get("mimeType") || "image/jpeg";
    const fileSize = parseInt(url.searchParams.get("fileSize") || "0");

    // Get configuration
    const { data: config } = await supabase
      .from("image_upload_config")
      .select("key, value")
      .in("key", ["max_file_size_mb", "allowed_mime_types", "signed_url_expiry_minutes", "max_images_per_review"]);

    const configMap = (config || []).reduce((acc: any, c: any) => {
      acc[c.key] = c.value;
      return acc;
    }, {});

    const maxSizeMB = configMap.max_file_size_mb || 5;
    const allowedMimes = configMap.allowed_mime_types || ["image/jpeg", "image/png", "image/webp"];
    const expiryMinutes = configMap.signed_url_expiry_minutes || 15;
    const maxImagesPerReview = configMap.max_images_per_review || 3;

    // Validation: mime type
    if (!allowedMimes.includes(mimeType)) {
      return new Response(
        JSON.stringify({
          error: `Invalid mime type. Allowed: ${allowedMimes.join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validation: file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (fileSize > maxSizeBytes) {
      return new Response(
        JSON.stringify({
          error: `File too large. Max size: ${maxSizeMB}MB`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validation: check image count for feedback_image type
    if (uploadType === "feedback_image") {
      // This is a soft check; actual enforcement happens when linking to review
      // Could add reviewId param and check count here if needed
    }

    // Generate unique file path
    const fileExt = filename.split(".").pop() || "jpg";
    const timestamp = Date.now();
    const randomId = crypto.randomUUID();
    const storagePath = `${uploadType}/${user.id}/${timestamp}_${randomId}.${fileExt}`;

    // Use Supabase Storage for signed upload URL
    // Note: Supabase Storage doesn't have native signed upload URLs like S3/GCS
    // We'll create a pre-authorized upload token approach or use direct upload with auth
    
    // For now, we'll use storage.createSignedUrl for download and direct upload with client auth
    // Alternative: Use AWS S3 SDK if you have S3 configured
    
    const STORAGE_BUCKET = Deno.env.get("UPLOAD_STORAGE_BUCKET") || "uploads";
    
    // Create a temporary upload record
    const { data: uploadRecord, error: insertError } = await supabase
      .from("image_uploads")
      .insert({
        uploader_id: user.id,
        upload_type: uploadType,
        original_filename: filename,
        mime_type: mimeType,
        file_size_bytes: fileSize,
        original_url: `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`,
        processing_status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return upload instructions
    // Client will upload directly to Supabase Storage using their auth token
    return new Response(
      JSON.stringify({
        uploadId: uploadRecord.id,
        storagePath,
        bucket: STORAGE_BUCKET,
        uploadUrl: `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`,
        method: "POST",
        headers: {
          "Content-Type": mimeType,
          "Authorization": authHeader, // Client must include their auth header
        },
        expiresIn: expiryMinutes * 60,
        maxSizeBytes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("get-signed-upload-url error", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
