import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, X } from 'lucide-react';

interface LocationPermissionProps {
  onLocationGranted: (lat: number, lng: number) => void;
  onDismiss: () => void;
}

export const LocationPermission = ({ onLocationGranted, onDismiss }: LocationPermissionProps) => {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getErrorMessage = (error: GeolocationPositionError): string => {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Location permission denied. Please enable location access in your browser settings.';
      case error.POSITION_UNAVAILABLE:
        return 'Position update is unavailable';
      case error.TIMEOUT:
        return 'Location request timed out. Please try again.';
      default:
        return 'Unable to retrieve your location. Please try again or check your device settings.';
    }
  };

  const requestLocation = () => {
    setRequesting(true);
    setError(null);

    // Check if geolocation is supported
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser');
      setRequesting(false);
      return;
    }

    // Check if HTTPS (required for geolocation in production)
    if (window.location.protocol !== 'https:' && !window.location.hostname.includes('localhost')) {
      setError('Location access requires a secure connection (HTTPS)');
      setRequesting(false);
      return;
    }

    // Request location with better options for reliability
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setRequesting(false);
        setError(null);
        onLocationGranted(position.coords.latitude, position.coords.longitude);
      },
      (err) => {
        setRequesting(false);
        setError(getErrorMessage(err));
      },
      {
        enableHighAccuracy: false, // Use less accurate but faster method
        timeout: 15000, // 15 second timeout
        maximumAge: 300000 // Use cached location if less than 5 minutes old
      }
    );
  };

  return (
    <Card className="mb-4 shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <CardTitle>Find Nearby Shops</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onDismiss} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Allow location access to see products from shops near you
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 border border-red-500 rounded-lg bg-red-50 dark:bg-red-900/10">
            <p className="text-sm text-red-700 dark:text-red-400 font-medium">
              {error}
            </p>
          </div>
        )}
        <Button 
          onClick={requestLocation} 
          disabled={requesting}
          className="w-full bg-primary hover:bg-primary/90 text-white"
        >
          {requesting ? 'Getting Location...' : 'Enable Location'}
        </Button>
      </CardContent>
    </Card>
  );
};
