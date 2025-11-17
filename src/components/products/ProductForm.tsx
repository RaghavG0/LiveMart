import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

const productSchema = z.object({
  name: z.string().min(1, "Product name is required").max(100),
  description: z.string().max(500).optional(),
  price: z.coerce.number().min(0, "Price must be positive"),
  stock_quantity: z.coerce.number().int().min(0, "Stock must be non-negative"),
  category_id: z.string().uuid("Please select a category"),
  is_available: z.boolean(),
  availability_date: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock_quantity: number;
  category_id?: string;
  is_available: boolean;
  availability_date?: string;
  image_url?: string;
}

interface ProductFormProps {
  product?: Product;
  onSuccess: () => void;
  onCancel: () => void;
}

export const ProductForm = ({ product, onSuccess, onCancel }: ProductFormProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(product?.image_url || null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product || {
      is_available: true,
      stock_quantity: 0,
    },
  });

  const isAvailable = watch("is_available");

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name")
      .order("name");

    if (error) {
      toast.error("Failed to load categories");
      return;
    }

    setCategories(data || []);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const uploadImage = async (userId: string): Promise<string | null> => {
    if (!imageFile) return product?.image_url || null;

    const fileExt = imageFile.name.split(".").pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(fileName, imageFile);

    if (uploadError) {
      toast.error("Failed to upload image");
      return null;
    }

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const onSubmit = async (data: ProductFormData) => {
    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("You must be logged in");
        return;
      }

      const imageUrl = await uploadImage(userData.user.id);

      const productData = {
        name: data.name,
        description: data.description,
        price: data.price,
        stock_quantity: data.stock_quantity,
        category_id: data.category_id,
        is_available: data.is_available,
        image_url: imageUrl,
        seller_id: userData.user.id,
        availability_date: data.availability_date || null,
      };

      if (product) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", product.id);

        if (error) throw error;
        toast.success("Product updated successfully");
      } else {
        const { error } = await supabase
          .from("products")
          .insert([productData]);

        if (error) throw error;
        toast.success("Product created successfully");
      }

      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to save product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="image">Product Image</Label>
        <div className="flex items-center gap-4">
          {imagePreview && (
            <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-border">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setImageFile(null);
                  setImagePreview(null);
                }}
                className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-xs text-muted-foreground">Upload Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Product Name *</Label>
        <Input id="name" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" {...register("description")} rows={3} />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">Price *</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            {...register("price")}
          />
          {errors.price && (
            <p className="text-sm text-destructive">{errors.price.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock_quantity">Stock Quantity *</Label>
          <Input
            id="stock_quantity"
            type="number"
            {...register("stock_quantity")}
          />
          {errors.stock_quantity && (
            <p className="text-sm text-destructive">
              {errors.stock_quantity.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category_id">Category *</Label>
        <Select
          onValueChange={(value) => setValue("category_id", value)}
          defaultValue={product?.category_id}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category_id && (
          <p className="text-sm text-destructive">{errors.category_id.message}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="is_available">Available for Sale</Label>
        <Switch
          id="is_available"
          checked={isAvailable}
          onCheckedChange={(checked) => setValue("is_available", checked)}
        />
      </div>

      {!isAvailable && (
        <div className="space-y-2">
          <Label htmlFor="availability_date">Expected Availability Date</Label>
          <Input
            id="availability_date"
            type="date"
            {...register("availability_date")}
          />
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Saving..." : product ? "Update Product" : "Create Product"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
};
