import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LocationCoords {
  lat: number;
  lng: number;
  address?: string;
}

export const useUserLocation = () => {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserLocation();
  }, []);

  const fetchUserLocation = async () => {
    try {
      // First, try to get location from user's profile
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('location_lat, location_lng, location_address')
          .eq('id', user.id)
          .single();

        if (profile?.location_lat && profile?.location_lng) {
          setLocation({
            lat: Number(profile.location_lat),
            lng: Number(profile.location_lng),
            address: profile.location_address || undefined
          });
          setLoading(false);
          return;
        }
      }

      // Fallback to browser geolocation with retry logic
      if ('geolocation' in navigator) {
        // Check for HTTPS or localhost
        if (window.location.protocol !== 'https:' && !window.location.hostname.includes('localhost')) {
          setError('Location access requires HTTPS');
          setLoading(false);
          return;
        }

        // Try to get location with retry logic
        const attemptGetLocation = (attempt: number = 1) => {
          const geoOptions: PositionOptions = {
            enableHighAccuracy: attempt === 1, // Try high accuracy first, then fallback
            timeout: attempt === 1 ? 20000 : 15000,
            maximumAge: attempt === 1 ? 0 : 300000 // No cache for first attempt, use cache for retries
          };

          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log('Location retrieved:', position.coords.latitude, position.coords.longitude);
              setLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude
              });
              setError(null);
              setLoading(false);
            },
            (err) => {
              console.error('Geolocation error:', err);
              
              // Retry up to 2 times with different settings
              if (attempt < 3 && err.code !== err.PERMISSION_DENIED) {
                setTimeout(() => {
                  attemptGetLocation(attempt + 1);
                }, 1000 * attempt); // Exponential backoff
                return;
              }

              let errorMessage = 'Unable to get location. ';
              
              switch(err.code) {
                case err.PERMISSION_DENIED:
                  errorMessage += 'Permission denied. Enable location in browser settings.';
                  break;
                case err.POSITION_UNAVAILABLE:
                  errorMessage += 'Location unavailable. Make sure GPS/location services are enabled on your device.';
                  break;
                case err.TIMEOUT:
                  errorMessage += 'Request timed out. Please try again.';
                  break;
                default:
                  errorMessage += err.message;
              }
              
              setError(errorMessage);
              setLoading(false);
            },
            geoOptions
          );
        };

        attemptGetLocation(1);
      } else {
        setError('Geolocation not supported by your browser');
        setLoading(false);
      }
    } catch (err) {
      setError('Failed to fetch location');
      setLoading(false);
    }
  };

  return { location, loading, error, refetch: fetchUserLocation };
};
