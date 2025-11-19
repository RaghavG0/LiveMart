import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OrderStatusBadgeProps {
  status: string;
  className?: string;
}

const OrderStatusBadge = ({ status, className }: OrderStatusBadgeProps) => {
  const getStatusConfig = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return { label: "Pending", variant: "secondary" as const, className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400" };
      case "confirmed":
        return { label: "Confirmed", variant: "default" as const, className: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400" };
      case "processing":
        return { label: "Processing", variant: "default" as const, className: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400" };
      case "shipped":
        return { label: "Shipped", variant: "default" as const, className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400" };
      case "delivered":
        return { label: "Delivered", variant: "default" as const, className: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" };
      case "cancelled":
        return { label: "Cancelled", variant: "destructive" as const, className: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400" };
      default:
        return { label: status || "Unknown", variant: "outline" as const, className: "" };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge variant={config.variant} className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
};

export default OrderStatusBadge;
