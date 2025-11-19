import { Check, Clock, Package, Truck, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineStep {
  status: string;
  label: string;
  timestamp?: string;
  icon: React.ReactNode;
}

interface OrderTimelineProps {
  currentStatus: string;
  statusTimeline?: Array<{ status: string; timestamp: string }>;
}

const OrderTimeline = ({ currentStatus, statusTimeline = [] }: OrderTimelineProps) => {
  const allSteps: TimelineStep[] = [
    { status: "pending", label: "Order Placed", icon: <Clock className="w-4 h-4" /> },
    { status: "confirmed", label: "Confirmed", icon: <Check className="w-4 h-4" /> },
    { status: "processing", label: "Processing", icon: <Package className="w-4 h-4" /> },
    { status: "shipped", label: "Shipped", icon: <Truck className="w-4 h-4" /> },
    { status: "delivered", label: "Delivered", icon: <CheckCircle className="w-4 h-4" /> },
  ];

  const statusOrder = ["pending", "confirmed", "processing", "shipped", "delivered"];
  const currentIndex = statusOrder.indexOf(currentStatus);
  const isCancelled = currentStatus === "cancelled";

  const getStepStatus = (index: number) => {
    if (isCancelled) return "cancelled";
    if (index < currentIndex) return "completed";
    if (index === currentIndex) return "current";
    return "pending";
  };

  const getTimestamp = (status: string) => {
    const entry = statusTimeline.find(s => s.status === status);
    if (entry?.timestamp) {
      return new Date(entry.timestamp).toLocaleString();
    }
    return null;
  };

  if (isCancelled) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
        <XCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
        <p className="font-semibold text-destructive">Order Cancelled</p>
        {getTimestamp("cancelled") && (
          <p className="text-sm text-muted-foreground mt-1">{getTimestamp("cancelled")}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {allSteps.map((step, index) => {
        const stepStatus = getStepStatus(index);
        const timestamp = getTimestamp(step.status);

        return (
          <div key={step.status} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                  stepStatus === "completed" && "bg-primary border-primary text-primary-foreground",
                  stepStatus === "current" && "bg-primary/10 border-primary text-primary animate-pulse",
                  stepStatus === "pending" && "bg-muted border-muted-foreground/20 text-muted-foreground"
                )}
              >
                {step.icon}
              </div>
              {index < allSteps.length - 1 && (
                <div
                  className={cn(
                    "w-0.5 h-12 transition-colors",
                    stepStatus === "completed" ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
            <div className="flex-1 pb-8">
              <p
                className={cn(
                  "font-semibold",
                  stepStatus === "completed" && "text-foreground",
                  stepStatus === "current" && "text-primary",
                  stepStatus === "pending" && "text-muted-foreground"
                )}
              >
                {step.label}
              </p>
              {timestamp && (
                <p className="text-sm text-muted-foreground mt-1">{timestamp}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OrderTimeline;
