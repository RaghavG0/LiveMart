import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LocationStatusBannerProps {
  show: boolean;
}

export const LocationStatusBanner = ({ show }: LocationStatusBannerProps) => {
  const navigate = useNavigate();

  if (!show) return null;

  return (
    <Alert variant="destructive" className="mb-6">
      <MapPin className="h-4 w-4" />
      <AlertTitle>Shop Location Required</AlertTitle>
      <AlertDescription className="flex items-center justify-between mt-2">
        <span>Set your shop location to start listing products and appear on the map for customers.</span>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate('/account')}
          className="ml-4 whitespace-nowrap"
        >
          Set Location Now →
        </Button>
      </AlertDescription>
    </Alert>
  );
};
