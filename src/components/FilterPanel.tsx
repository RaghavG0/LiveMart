import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Minus, Plus, RotateCcw, Filter } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export interface FilterState {
  priceRange: [number, number];
  minStock: number;
  inStockOnly: boolean;
  sortBy: "none" | "price-asc" | "price-desc" | "distance-asc";
  maxDistance: number | null;
  nearbyOnly: boolean;
  categoryId: string | null;
  subcategoryId: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  maxPrice: number;
  hasLocation?: boolean;
  variant?: "sidebar" | "modal";
}

// Default filters will be created dynamically with maxPrice
const getDefaultFilters = (maxPrice: number): FilterState => ({
  priceRange: [0, maxPrice],
  minStock: 0,
  inStockOnly: false,
  sortBy: "none",
  maxDistance: null,
  nearbyOnly: false,
  categoryId: null,
  subcategoryId: null,
});

const FilterPanel = ({ filters, onFiltersChange, maxPrice, hasLocation = false, variant = "sidebar" }: FilterPanelProps) => {
  const [tempFilters, setTempFilters] = useState<FilterState>(filters);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize tempFilters when filters prop changes (from parent)
  useEffect(() => {
    setTempFilters(filters);
    // Reset subcategory when category changes externally
    if (filters.categoryId !== tempFilters.categoryId) {
      setTempFilters(prev => ({ ...prev, subcategoryId: null }));
    }
  }, [filters]);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch subcategories when category changes
  useEffect(() => {
    if (tempFilters.categoryId) {
      fetchSubcategories(tempFilters.categoryId);
    } else {
      setSubcategories([]);
    }
  }, [tempFilters.categoryId]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubcategories = async (categoryId: string) => {
    try {
      // For now, subcategories are just categories. 
      // If you have a separate subcategories table, update this query
      // For this implementation, we'll use categories as subcategories
      // You can extend this later with a proper subcategories table
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .order("name");

      if (error) throw error;
      // For now, show all categories as subcategories
      // In production, you'd filter by parent_id or category_id
      setSubcategories(data || []);
    } catch (error) {
      console.error("Error fetching subcategories:", error);
      setSubcategories([]);
    }
  };

  const handlePriceChange = (index: 0 | 1, increment: boolean) => {
    const newRange: [number, number] = [...tempFilters.priceRange];
    const step = 50;
    
    if (increment) {
      newRange[index] = Math.min(newRange[index] + step, maxPrice);
    } else {
      newRange[index] = Math.max(newRange[index] - step, 0);
    }
    
    // Ensure min doesn't exceed max and vice versa
    if (index === 0 && newRange[0] > newRange[1]) {
      newRange[0] = newRange[1];
    } else if (index === 1 && newRange[1] < newRange[0]) {
      newRange[1] = newRange[0];
    }
    
    setTempFilters({ ...tempFilters, priceRange: newRange });
  };

  const handleApplyFilters = () => {
    onFiltersChange(tempFilters);
  };

  const handleResetFilters = () => {
    const resetFilters = getDefaultFilters(maxPrice);
    setTempFilters(resetFilters);
    onFiltersChange(resetFilters);
  };

  return (
    <Card className={variant === "sidebar" ? "sticky top-4 border border-gray-200 bg-white shadow-md" : "border border-gray-200 bg-white shadow-md"}>
      <CardHeader>
        <CardTitle className="text-lg text-gray-900">Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Category Filter */}
        <div className="space-y-2">
          <Label htmlFor="category" className="text-sm font-medium">
            Category
          </Label>
          <Select
            value={tempFilters.categoryId || "all"}
            onValueChange={(value) => 
              setTempFilters({ 
                ...tempFilters, 
                categoryId: value === "all" ? null : value,
                subcategoryId: null // Reset subcategory when category changes
              })
            }
          >
            <SelectTrigger id="category">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Subcategory Filter - Only show if category is selected */}
        {tempFilters.categoryId && (
          <div className="space-y-2">
            <Label htmlFor="subcategory" className="text-sm font-medium">
              Subcategory
            </Label>
            <Select
              value={tempFilters.subcategoryId || "all"}
              onValueChange={(value) => 
                setTempFilters({ 
                  ...tempFilters, 
                  subcategoryId: value === "all" ? null : value
                })
              }
            >
              <SelectTrigger id="subcategory">
                <SelectValue placeholder="All Subcategories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subcategories</SelectItem>
                {subcategories.map((subcategory) => (
                  <SelectItem key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {/* Price Range */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Price Range</Label>
          <div className="space-y-3">
            <Slider
              value={tempFilters.priceRange}
              onValueChange={(value) => 
                setTempFilters({ ...tempFilters, priceRange: value as [number, number] })
              }
              max={maxPrice}
              step={10}
              className="w-full"
            />
            
            {/* Lower End Controls */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Minimum Price</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePriceChange(0, false)}
                  disabled={tempFilters.priceRange[0] === 0}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="flex-1 text-center font-medium">
                  ₹{tempFilters.priceRange[0]}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePriceChange(0, true)}
                  disabled={tempFilters.priceRange[0] >= tempFilters.priceRange[1]}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Higher End Controls */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Maximum Price</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePriceChange(1, false)}
                  disabled={filters.priceRange[1] <= filters.priceRange[0]}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="flex-1 text-center font-medium">
                  ₹{tempFilters.priceRange[1]}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePriceChange(1, true)}
                  disabled={tempFilters.priceRange[1] >= maxPrice}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sort by Price */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Sort by Price</Label>
          <RadioGroup 
            value={tempFilters.sortBy} 
            onValueChange={(value) => 
              setTempFilters({ ...tempFilters, sortBy: value as FilterState["sortBy"] })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="none" id="sort-none" />
              <Label htmlFor="sort-none" className="cursor-pointer font-normal">
                Default
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="price-asc" id="sort-asc" />
              <Label htmlFor="sort-asc" className="cursor-pointer font-normal">
                Price: Low to High
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="price-desc" id="sort-desc" />
              <Label htmlFor="sort-desc" className="cursor-pointer font-normal">
                Price: High to Low
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Minimum Stock */}
        <div className="space-y-2">
          <Label htmlFor="minStock" className="text-sm font-medium">
            Minimum Stock Quantity
          </Label>
          <Input
            id="minStock"
            type="number"
            min="0"
            value={tempFilters.minStock}
            onChange={(e) => 
              setTempFilters({ ...tempFilters, minStock: parseInt(e.target.value) || 0 })
            }
            placeholder="0"
          />
        </div>

        {/* Stock Availability */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="inStockOnly"
            checked={tempFilters.inStockOnly}
            onCheckedChange={(checked) => 
              setTempFilters({ ...tempFilters, inStockOnly: checked as boolean })
            }
          />
          <Label 
            htmlFor="inStockOnly" 
            className="text-sm font-medium cursor-pointer"
          >
            In Stock Only
          </Label>
        </div>

        {/* Distance Filter - Only show if location is available */}
        {hasLocation && (
          <>
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Max Distance</Label>
                <span className="text-sm text-muted-foreground">
                  {tempFilters.maxDistance ? `${tempFilters.maxDistance} km` : 'Any'}
                </span>
              </div>
              <Slider
                value={[tempFilters.maxDistance || 50]}
                onValueChange={([value]) => 
                  setTempFilters({ ...tempFilters, maxDistance: value })
                }
                min={1}
                max={50}
                step={1}
                className="w-full"
              />
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="nearby-only" 
                  checked={tempFilters.nearbyOnly}
                  onCheckedChange={(checked) => 
                    setTempFilters({ 
                      ...tempFilters, 
                      nearbyOnly: checked as boolean,
                      maxDistance: checked ? (tempFilters.maxDistance || 10) : null
                    })
                  }
                />
                <Label htmlFor="nearby-only" className="text-sm font-medium cursor-pointer">
                  Nearby Shops Only
                </Label>
              </div>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-4 border-t">
          <Button 
            onClick={handleApplyFilters}
            className="w-full"
            size="lg"
          >
            <Filter className="h-4 w-4 mr-2" />
            Apply Filters
          </Button>
          <Button 
            onClick={handleResetFilters}
            variant="outline"
            className="w-full"
            size="lg"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FilterPanel;
