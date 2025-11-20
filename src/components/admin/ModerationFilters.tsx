import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ModerationFilters, ModerationStatus } from "@/types/moderation";
import { Filter, X } from "lucide-react";

interface ModerationFiltersProps {
  filters: ModerationFilters;
  onFiltersChange: (filters: ModerationFilters) => void;
  onApply: () => void;
}

export function ModerationFiltersComponent({
  filters,
  onFiltersChange,
  onApply,
}: ModerationFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleReset = () => {
    onFiltersChange({});
    onApply();
  };

  const activeFilterCount = Object.keys(filters).filter(
    (key) => filters[key as keyof ModerationFilters] !== undefined
  ).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({activeFilterCount} active)
              </span>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Collapse" : "Expand"}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.status || ""}
                onValueChange={(value) =>
                  onFiltersChange({
                    ...filters,
                    status: value as ModerationStatus,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="flagged">Flagged</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority Filter */}
            <div className="space-y-2">
              <Label>Minimum Priority</Label>
              <Input
                type="number"
                placeholder="0"
                value={filters.minPriority || ""}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    minPriority: e.target.value
                      ? parseInt(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>

            {/* Rating Range */}
            <div className="space-y-2">
              <Label>Rating Range</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  max="5"
                  placeholder="Min"
                  value={filters.minRating || ""}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      minRating: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                />
                <Input
                  type="number"
                  min="1"
                  max="5"
                  placeholder="Max"
                  value={filters.maxRating || ""}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      maxRating: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label>Date From</Label>
              <Input
                type="date"
                value={filters.dateFrom || ""}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    dateFrom: e.target.value || undefined,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={filters.dateTo || ""}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    dateTo: e.target.value || undefined,
                  })
                }
              />
            </div>

            {/* Flagged Only */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Switch
                  checked={filters.flaggedOnly || false}
                  onCheckedChange={(checked) =>
                    onFiltersChange({
                      ...filters,
                      flaggedOnly: checked,
                    })
                  }
                />
                Flagged Only
              </Label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button onClick={onApply} className="flex-1">
              Apply Filters
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
