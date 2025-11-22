import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Extend Window interface for OlaMaps SDK loaded from CDN
declare global {
  interface Window {
    OlaMaps?: any;
  }
}

interface MapViewProps {
  userLocation: { lat: number; lng: number } | null;
  onSellerSelect?: (sellerId: string) => void;
}

interface Seller {
  id: string;
  full_name: string;
  location_lat: number;
  location_lng: number;
  location_address: string | null;
  role: string;
}

const MapView = ({ userLocation, onSellerSelect }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [OlaMapsLoaded, setOlaMapsLoaded] = useState(false);

  // Load OLA Maps SDK from CDN
  useEffect(() => {
    // Check if already loaded
    if (typeof window.OlaMaps !== 'undefined') {
      setOlaMapsLoaded(true);
      return;
    }

    // Wait for CDN script to load
    const checkOlaMaps = setInterval(() => {
      if (typeof window.OlaMaps !== 'undefined') {
        setOlaMapsLoaded(true);
        clearInterval(checkOlaMaps);
      }
    }, 100);

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkOlaMaps);
      if (typeof window.OlaMaps === 'undefined') {
        console.error('OlaMaps SDK failed to load from CDN');
        toast.error('Map failed to load. Please refresh the page.');
        setLoading(false);
      }
    }, 10000);
  }, []);

  // Fetch sellers with locations
  useEffect(() => {
    fetchSellers();
  }, []);

  const fetchSellers = async () => {
    try {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['retailer', 'wholesaler']);

      if (!userRoles || userRoles.length === 0) {
        setSellers([]);
        return;
      }

      const userIds = userRoles.map(ur => ur.user_id);
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, location_lat, location_lng, location_address')
        .in('id', userIds)
        .not('location_lat', 'is', null)
        .not('location_lng', 'is', null);

      if (error) throw error;

      const sellersWithRoles = profiles?.map(profile => {
        const role = userRoles.find(ur => ur.user_id === profile.id)?.role || '';
        return {
          ...profile,
          location_lat: Number(profile.location_lat),
          location_lng: Number(profile.location_lng),
          role
        };
      }) || [];

      setSellers(sellersWithRoles);
    } catch (error) {
      console.error('Error fetching sellers:', error);
      toast.error('Failed to load seller locations');
    }
  };

  // Initialize map
  useEffect(() => {
    if (!OlaMapsLoaded || !mapContainer.current || mapInstance.current) return;

    const apiKey = import.meta.env.VITE_OLA_MAPS_API_KEY;
    if (!apiKey) {
      toast.error('OLA Maps API key not configured');
      setLoading(false);
      return;
    }

    // @ts-ignore - OlaMaps is loaded from CDN
    if (typeof window.OlaMaps === 'undefined') {
      console.error('OlaMaps SDK not available');
      toast.error('Map SDK not loaded. Please refresh the page.');
      setLoading(false);
      return;
    }

    try {
      // @ts-ignore - OlaMaps is loaded from CDN
      const olaMaps = new window.OlaMaps({ apiKey });

      const center = userLocation 
        ? [userLocation.lng, userLocation.lat]
        : [77.5946, 12.9716]; // Default to Bangalore

      const myMap = olaMaps.init({
        style: 'https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json',
        container: mapContainer.current,
        center,
        zoom: userLocation ? 12 : 10,
      });

      mapInstance.current = { olaMaps, myMap };

      // Add user location marker if available
      if (userLocation) {
        const userMarkerEl = document.createElement('div');
        userMarkerEl.className = 'user-location-marker';
        userMarkerEl.style.width = '20px';
        userMarkerEl.style.height = '20px';
        userMarkerEl.style.borderRadius = '50%';
        userMarkerEl.style.backgroundColor = 'hsl(var(--primary))';
        userMarkerEl.style.border = '3px solid white';
        userMarkerEl.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';

        olaMaps
          .addMarker({ element: userMarkerEl })
          .setLngLat([userLocation.lng, userLocation.lat])
          .addTo(myMap);
      }

      // Add seller markers
      sellers.forEach((seller) => {
        const markerEl = document.createElement('div');
        markerEl.className = 'seller-marker';
        markerEl.style.width = '30px';
        markerEl.style.height = '30px';
        markerEl.style.borderRadius = '50%';
        markerEl.style.backgroundColor = seller.role === 'retailer' 
          ? 'hsl(var(--secondary))' 
          : 'hsl(var(--accent))';
        markerEl.style.border = '2px solid white';
        markerEl.style.cursor = 'pointer';
        markerEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        markerEl.style.display = 'flex';
        markerEl.style.alignItems = 'center';
        markerEl.style.justifyContent = 'center';
        markerEl.style.color = 'white';
        markerEl.style.fontSize = '12px';
        markerEl.style.fontWeight = 'bold';
        markerEl.innerHTML = seller.role === 'retailer' ? 'R' : 'W';

        markerEl.addEventListener('click', () => {
          setSelectedSeller(seller);
          if (onSellerSelect) {
            onSellerSelect(seller.id);
          }
        });

        olaMaps
          .addMarker({ element: markerEl })
          .setLngLat([seller.location_lng, seller.location_lat])
          .addTo(myMap);
      });

      setLoading(false);
    } catch (error) {
      console.error('Error initializing map:', error);
      toast.error('Failed to initialize map');
      setLoading(false);
    }
  }, [OlaMapsLoaded, userLocation, sellers, onSellerSelect]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-muted/10 rounded-lg">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative h-[600px]">
        <div ref={mapContainer} className="w-full h-full rounded-lg border shadow-lg" />
        
        {sellers.length === 0 && !loading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg border z-10">
            <p className="text-sm text-muted-foreground">
              No sellers found with location data
            </p>
          </div>
        )}
      </div>
      
      {selectedSeller && (
        <Card className="absolute top-4 right-4 p-4 max-w-xs shadow-xl">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-semibold text-lg">{selectedSeller.full_name}</h3>
              <p className="text-sm text-muted-foreground capitalize">{selectedSeller.role}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedSeller(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {selectedSeller.location_address && (
            <p className="text-sm mb-3">{selectedSeller.location_address}</p>
          )}
          <Button 
            onClick={() => {
              if (onSellerSelect) {
                onSellerSelect(selectedSeller.id);
              }
            }}
            className="w-full"
          >
            View Products
          </Button>
        </Card>
      )}

      <div className="absolute bottom-4 left-4 bg-card p-3 rounded-lg shadow-lg border">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-primary border-2 border-white"></div>
            <span>Your Location</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-secondary border-2 border-white flex items-center justify-center text-[8px] text-white font-bold">R</div>
            <span>Retailer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-accent border-2 border-white flex items-center justify-center text-[8px] text-white font-bold">W</div>
            <span>Wholesaler</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapView;
