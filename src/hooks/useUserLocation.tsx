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

      // Fallback to browser geolocation
      if ('geolocation' in navigator) {
        // Check for HTTPS or localhost
        if (window.location.protocol !== 'https:' && !window.location.hostname.includes('localhost')) {
          setError('Location access requires HTTPS');
          setLoading(false);
          return;
        }

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
            let errorMessage = 'Unable to get location. ';
            
            switch(err.code) {
              case err.PERMISSION_DENIED:
                errorMessage += 'Permission denied. Enable location in browser settings.';
                break;
              case err.POSITION_UNAVAILABLE:
                errorMessage += 'Location unavailable. Check device GPS settings.';
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
          {
            enableHighAccuracy: false, // Changed to false for faster response
            timeout: 15000, // Increased timeout
            maximumAge: 300000 // Cache for 5 minutes
          }
        );
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
