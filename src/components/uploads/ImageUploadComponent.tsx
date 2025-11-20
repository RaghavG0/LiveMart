import React, { useRef } from "react";
import { useImageUpload, UploadProgress } from "@/hooks/useImageUpload";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Upload, ImageIcon, AlertCircle, CheckCircle } from "lucide-react";

interface ImageUploadComponentProps {
  uploadType?: string;
  maxFiles?: number;
  maxSizeMB?: number;
  onUploadComplete?: (uploadIds: string[]) => void;
  existingImages?: string[];
}

export const ImageUploadComponent: React.FC<ImageUploadComponentProps> = ({
  uploadType = "feedback_image",
  maxFiles = 3,
  maxSizeMB = 5,
  onUploadComplete,
  existingImages = [],
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploads, isUploading, uploadFiles, removeUpload } = useImageUpload({
    uploadType,
    maxFiles,
    maxSizeMB,
    onComplete: (uploadId, url) => {
      console.log("Upload complete:", uploadId, url);
    },
    onError: (error) => {
      console.error("Upload error:", error);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const uploadIds = await uploadFiles(files);
    
    if (uploadIds.length > 0 && onUploadComplete) {
      onUploadComplete(uploadIds);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const totalImages = existingImages.length + uploads.length;
  const canUploadMore = totalImages < maxFiles;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Images ({totalImages}/{maxFiles})
        </h3>
        {canUploadMore && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClick}
            disabled={isUploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? "Uploading..." : "Add Images"}
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="grid grid-cols-3 gap-3">
        {/* Existing images */}
        {existingImages.map((url, idx) => (
          <Card key={`existing-${idx}`} className="p-2">
            <div className="aspect-square relative bg-gray-100 rounded overflow-hidden">
              <img
                src={url}
                alt={`Existing ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          </Card>
        ))}

        {/* Upload progress */}
        {uploads.map((upload) => (
          <Card key={upload.uploadId} className="p-2 relative">
            <div className="aspect-square relative bg-gray-100 rounded overflow-hidden flex items-center justify-center">
              {upload.status === "pending" && (
                <ImageIcon className="h-8 w-8 text-gray-400" />
              )}
              {upload.status === "uploading" && (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                  <div className="text-xs text-gray-500">{upload.progress}%</div>
                </div>
              )}
              {upload.status === "complete" && upload.url && (
                <>
                  <img
                    src={upload.url}
                    alt={upload.filename}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                </>
              )}
              {upload.status === "error" && (
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <div className="text-xs text-red-600">{upload.error}</div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeUpload(upload.uploadId)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mt-1 text-xs text-gray-600 truncate">
              {upload.filename}
            </div>
          </Card>
        ))}

        {/* Empty slots */}
        {Array.from({ length: Math.max(0, maxFiles - totalImages) }).map((_, idx) => (
          <Card
            key={`empty-${idx}`}
            className="p-2 border-dashed cursor-pointer hover:bg-gray-50"
            onClick={handleClick}
          >
            <div className="aspect-square flex items-center justify-center bg-gray-50 rounded">
              <div className="text-center">
                <Upload className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                <div className="text-xs text-gray-500">Add image</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="text-xs text-gray-500">
        Max {maxFiles} images • Up to {maxSizeMB}MB each • JPEG, PNG, WebP
      </div>
    </div>
  );
};
