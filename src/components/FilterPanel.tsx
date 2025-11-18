import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export interface FilterState {
  priceRange: [number, number];
  minStock: number;
  inStockOnly: boolean;
}

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  maxPrice: number;
}

const FilterPanel = ({ filters, onFiltersChange, maxPrice }: FilterPanelProps) => {
  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="text-lg">Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Price Range */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Price Range</Label>
          <div className="space-y-2">
            <Slider
              value={filters.priceRange}
              onValueChange={(value) => 
                onFiltersChange({ ...filters, priceRange: value as [number, number] })
              }
              max={maxPrice}
              step={10}
              className="w-full"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>${filters.priceRange[0]}</span>
              <span>${filters.priceRange[1]}</span>
            </div>
          </div>
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
      </CardContent>
    </Card>
  );
};

export default FilterPanel;
