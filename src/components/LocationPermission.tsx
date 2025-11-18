import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface LocationPermissionProps {
  onLocationGranted: (lat: number, lng: number) => void;
  onDismiss: () => void;
}

export const LocationPermission = ({ onLocationGranted, onDismiss }: LocationPermissionProps) => {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = () => {
    setRequesting(true);
    setError(null);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          onLocationGranted(position.coords.latitude, position.coords.longitude);
          setRequesting(false);
        },
        (err) => {
          setError(err.message);
          setRequesting(false);
        }
      );
    } else {
      setError('Geolocation is not supported by your browser');
      setRequesting(false);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <CardTitle>Find Nearby Shops</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Allow location access to see products from shops near you
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button 
          onClick={requestLocation} 
          disabled={requesting}
          className="w-full"
        >
          {requesting ? 'Getting Location...' : 'Enable Location'}
        </Button>
      </CardContent>
    </Card>
  );
};
