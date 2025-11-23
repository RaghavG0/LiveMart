import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface LowStockAlertProps {
  outOfStockCount: number;
  onManageProducts?: () => void;
}

const LowStockAlert = ({ outOfStockCount, onManageProducts }: LowStockAlertProps) => {

  if (outOfStockCount === 0) return null;

  return (
    <Alert variant="destructive" className="mb-6 border-2 border-red-500">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="font-bold">Low Stock Warning</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3">
          Warning: You have <strong>{outOfStockCount}</strong> product{outOfStockCount > 1 ? 's' : ''} that {outOfStockCount > 1 ? 'are' : 'is'} out of stock. 
          Please restock them or delete them to avoid order cancellations.
        </p>
        {onManageProducts && (
          <Button
            variant="outline"
            size="sm"
            onClick={onManageProducts}
            className="border-red-500 text-red-600 hover:bg-red-50"
          >
            Manage Products
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default LowStockAlert;

