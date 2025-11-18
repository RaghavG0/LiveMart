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
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
            setLoading(false);
          },
          (err) => {
            setError(err.message);
            setLoading(false);
          }
        );
      } else {
        setError('Geolocation not supported');
        setLoading(false);
      }
    } catch (err) {
      setError('Failed to fetch location');
      setLoading(false);
    }
  };

  return { location, loading, error, refetch: fetchUserLocation };
};
