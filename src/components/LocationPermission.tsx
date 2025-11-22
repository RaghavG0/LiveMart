import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, X, RefreshCw } from 'lucide-react';

interface LocationPermissionProps {
  onLocationGranted: (lat: number, lng: number) => void;
  onDismiss: () => void;
}

export const LocationPermission = ({ onLocationGranted, onDismiss }: LocationPermissionProps) => {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const getErrorMessage = (error: GeolocationPositionError): string => {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Location permission denied. Please enable location access in your browser settings.';
      case error.POSITION_UNAVAILABLE:
        return 'Position update is unavailable. Make sure GPS/location services are enabled on your device.';
      case error.TIMEOUT:
        return 'Location request timed out. Please try again.';
      default:
        return 'Unable to retrieve your location. Please try again or check your device settings.';
    }
  };

  const requestLocation = async (attempt: number = 1) => {
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

    // Check permission state first (if available)
    try {
      if ('permissions' in navigator) {
        const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (result.state === 'denied') {
          setError('Location permission denied. Please enable location access in your browser settings.');
          setRequesting(false);
          return;
        }
      }
    } catch (e) {
      // Permission query not supported, continue
      console.log('Permission query not supported:', e);
    }

    // Request location with better options for reliability
    const geoOptions: PositionOptions = {
      enableHighAccuracy: attempt === 1, // Try high accuracy first, then fallback
      timeout: attempt === 1 ? 20000 : 15000, // Longer timeout for first attempt
      maximumAge: attempt === 1 ? 0 : 300000 // No cache for first attempt, use cache for retries
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setRequesting(false);
        setError(null);
        setRetryCount(0);
        onLocationGranted(position.coords.latitude, position.coords.longitude);
      },
      (err) => {
        // Retry up to 2 times with different settings
        if (attempt < 3 && err.code !== err.PERMISSION_DENIED) {
          setTimeout(() => {
            setRetryCount(attempt);
            requestLocation(attempt + 1);
          }, 1000 * attempt); // Exponential backoff
        } else {
          setRequesting(false);
          setError(getErrorMessage(err));
        }
      },
      geoOptions
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
            {retryCount > 0 && (
              <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                Retrying... (Attempt {retryCount + 1}/3)
              </p>
            )}
          </div>
        )}
        <Button 
          onClick={() => requestLocation(1)} 
          disabled={requesting}
          className="w-full bg-primary hover:bg-primary/90 text-white"
        >
          {requesting ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              {retryCount > 0 ? `Retrying... (${retryCount + 1}/3)` : 'Getting Location...'}
            </>
          ) : (
            'Enable Location'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
