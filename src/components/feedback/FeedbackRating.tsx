import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackRatingProps {
  rating: number;
  maxRating?: number;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  className?: string;
}

const FeedbackRating = ({
  rating,
  maxRating = 5,
  size = "md",
  showValue = false,
  interactive = false,
  onChange,
  className,
}: FeedbackRatingProps) => {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const handleClick = (value: number) => {
    if (interactive && onChange) {
      onChange(value);
    }
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {Array.from({ length: maxRating }, (_, i) => i + 1).map((value) => {
        const isFilled = value <= Math.round(rating);
        const isPartial = value === Math.ceil(rating) && rating % 1 !== 0;

        return (
          <button
            key={value}
            type="button"
            disabled={!interactive}
            onClick={() => handleClick(value)}
            className={cn(
              "relative transition-transform",
              interactive && "hover:scale-110 cursor-pointer",
              !interactive && "cursor-default"
            )}
          >
            <Star
              className={cn(
                sizeClasses[size],
                isFilled
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-none text-muted-foreground"
              )}
            />
            {isPartial && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${(rating % 1) * 100}%` }}
              >
                <Star
                  className={cn(
                    sizeClasses[size],
                    "fill-yellow-400 text-yellow-400"
                  )}
                />
              </div>
            )}
          </button>
        );
      })}
      {showValue && (
        <span
          className={cn(
            "ml-1 font-medium text-foreground",
            textSizeClasses[size]
          )}
        >
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
};

export default FeedbackRating;
