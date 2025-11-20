import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UploadProgress {
  uploadId: string;
  filename: string;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
  error?: string;
  url?: string;
}

interface UseImageUploadOptions {
  uploadType?: string;
  maxFiles?: number;
  maxSizeMB?: number;
  allowedMimeTypes?: string[];
  onComplete?: (uploadId: string, url: string) => void;
  onError?: (error: string) => void;
}

export function useImageUpload(options: UseImageUploadOptions = {}) {
  const {
    uploadType = "feedback_image",
    maxFiles = 3,
    maxSizeMB = 5,
    allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"],
    onComplete,
    onError,
  } = options;

  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!allowedMimeTypes.includes(file.type)) {
        return `Invalid file type. Allowed: ${allowedMimeTypes.join(", ")}`;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        return `File too large. Max: ${maxSizeMB}MB`;
      }
      return null;
    },
    [allowedMimeTypes, maxSizeMB]
  );

  const uploadFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        onError?.(validationError);
        return null;
      }

      if (uploads.length >= maxFiles) {
        onError?.(`Maximum ${maxFiles} files allowed`);
        return null;
      }

      const uploadId = crypto.randomUUID();
      
      setUploads((prev) => [
        ...prev,
        {
          uploadId,
          filename: file.name,
          progress: 0,
          status: "pending",
        },
      ]);

      try {
        // Get signed upload URL
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;

        if (!token) {
          throw new Error("Not authenticated");
        }

        const signedUrlResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_FUNCTION_URL || process.env.REACT_APP_SUPABASE_FUNCTION_URL}/get-signed-upload-url?` +
            new URLSearchParams({
              type: uploadType,
              filename: file.name,
              mimeType: file.type,
              fileSize: file.size.toString(),
            }),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!signedUrlResponse.ok) {
          const errorData = await signedUrlResponse.json();
          throw new Error(errorData.error || "Failed to get upload URL");
        }

        const uploadData = await signedUrlResponse.json();

        setUploads((prev) =>
          prev.map((u) =>
            u.uploadId === uploadId ? { ...u, status: "uploading" } : u
          )
        );

        // Upload to storage
        const formData = new FormData();
        formData.append("file", file);

        const uploadResponse = await fetch(uploadData.uploadUrl, {
          method: uploadData.method || "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error("Upload failed");
        }

        const uploadedUrl = uploadData.uploadUrl.replace(/\/upload$/, "");

        setUploads((prev) =>
          prev.map((u) =>
            u.uploadId === uploadId
              ? { ...u, status: "complete", progress: 100, url: uploadedUrl }
              : u
          )
        );

        onComplete?.(uploadData.uploadId, uploadedUrl);
        return uploadData.uploadId;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Upload failed";
        setUploads((prev) =>
          prev.map((u) =>
            u.uploadId === uploadId
              ? { ...u, status: "error", error: errorMessage }
              : u
          )
        );
        onError?.(errorMessage);
        return null;
      }
    },
    [uploadType, validateFile, uploads.length, maxFiles, onComplete, onError]
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      setIsUploading(true);
      const results = await Promise.all(files.map(uploadFile));
      setIsUploading(false);
      return results.filter(Boolean) as string[];
    },
    [uploadFile]
  );

  const removeUpload = useCallback((uploadId: string) => {
    setUploads((prev) => prev.filter((u) => u.uploadId !== uploadId));
  }, []);

  const reset = useCallback(() => {
    setUploads([]);
    setIsUploading(false);
  }, []);

  return {
    uploads,
    isUploading,
    uploadFile,
    uploadFiles,
    removeUpload,
    reset,
  };
}
