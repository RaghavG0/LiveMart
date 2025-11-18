import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useSellerLocation = (userId: string | undefined) => {
  const [hasLocation, setHasLocation] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const checkLocation = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('location_lat, location_lng')
          .eq('id', userId)
          .single();

        if (error) throw error;

        setHasLocation(
          data?.location_lat !== null && 
          data?.location_lng !== null &&
          data?.location_lat !== undefined &&
          data?.location_lng !== undefined
        );
      } catch (error) {
        console.error('Error checking location:', error);
        setHasLocation(false);
      } finally {
        setLoading(false);
      }
    };

    checkLocation();
  }, [userId]);

  return { hasLocation, loading };
};
