import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface FilterState {
  priceRange: [number, number];
  minStock: number;
  inStockOnly: boolean;
  sortBy: "none" | "price-asc" | "price-desc" | "distance-asc";
  maxDistance: number | null;
  nearbyOnly: boolean;
}

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  maxPrice: number;
  hasLocation?: boolean;
}

const FilterPanel = ({ filters, onFiltersChange, maxPrice, hasLocation = false }: FilterPanelProps) => {
  const handlePriceChange = (index: 0 | 1, increment: boolean) => {
    const newRange: [number, number] = [...filters.priceRange];
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
    
    onFiltersChange({ ...filters, priceRange: newRange });
  };

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="text-lg">Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Price Range */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Price Range</Label>
          <div className="space-y-3">
            <Slider
              value={filters.priceRange}
              onValueChange={(value) => 
                onFiltersChange({ ...filters, priceRange: value as [number, number] })
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
                  disabled={filters.priceRange[0] === 0}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="flex-1 text-center font-medium">
                  ${filters.priceRange[0]}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePriceChange(0, true)}
                  disabled={filters.priceRange[0] >= filters.priceRange[1]}
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
                  ${filters.priceRange[1]}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handlePriceChange(1, true)}
                  disabled={filters.priceRange[1] >= maxPrice}
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
            value={filters.sortBy} 
            onValueChange={(value) => 
              onFiltersChange({ ...filters, sortBy: value as FilterState["sortBy"] })
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
            value={filters.minStock}
            onChange={(e) => 
              onFiltersChange({ ...filters, minStock: parseInt(e.target.value) || 0 })
            }
            placeholder="0"
          />
        </div>

        {/* Stock Availability */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="inStockOnly"
            checked={filters.inStockOnly}
            onCheckedChange={(checked) => 
              onFiltersChange({ ...filters, inStockOnly: checked as boolean })
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
                  {filters.maxDistance ? `${filters.maxDistance} km` : 'Any'}
                </span>
              </div>
              <Slider
                value={[filters.maxDistance || 50]}
                onValueChange={([value]) => 
                  onFiltersChange({ ...filters, maxDistance: value })
                }
                min={1}
                max={50}
                step={1}
                className="w-full"
              />
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="nearby-only" 
                  checked={filters.nearbyOnly}
                  onCheckedChange={(checked) => 
                    onFiltersChange({ 
                      ...filters, 
                      nearbyOnly: checked as boolean,
                      maxDistance: checked ? (filters.maxDistance || 10) : null
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
      </CardContent>
    </Card>
  );
};

export default FilterPanel;
