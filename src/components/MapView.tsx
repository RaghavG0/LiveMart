import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Fix for default marker icon in Leaflet - use CDN URLs for production compatibility
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

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
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (!mapContainer.current || mapInstance.current) {
      // Map already initialized, just update if needed
      if (mapInstance.current && userLocation) {
        mapInstance.current.setView([userLocation.lat, userLocation.lng], 12);
      }
      return;
    }

    try {
      const center = userLocation 
        ? [userLocation.lat, userLocation.lng] as [number, number]
        : [12.9716, 77.5946] as [number, number]; // Default to Bangalore

      // Create map
      const map = L.map(mapContainer.current, {
        center,
        zoom: userLocation ? 12 : 10,
      });

      // Add OpenStreetMap tiles (free, no API key required)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstance.current = map;

      // Fallback: Set loading to false after timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        console.log('Map loading timeout - forcing loading to false');
        setLoading(false);
      }, 5000);

      // Wait for map to be ready before adding markers and setting loading to false
      map.whenReady(() => {
        // Clear the fallback timeout
        clearTimeout(timeoutId);
        
        // Force a resize to ensure map renders properly
        map.invalidateSize();
        
        // Add user location marker if available
        if (userLocation) {
          const userMarker = L.marker([userLocation.lat, userLocation.lng], {
            icon: L.divIcon({
              className: 'user-location-marker',
              html: '<div style="width: 20px; height: 20px; border-radius: 50%; background-color: hsl(var(--primary)); border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            })
          }).addTo(map);

          markersRef.current.push(userMarker);
        }
        
        // Set loading to false after map is ready and tiles start loading
        setTimeout(() => {
          setLoading(false);
        }, 500);
      });
    } catch (error) {
      console.error('Error initializing map:', error);
      toast.error('Failed to initialize map');
      setLoading(false);
    }
  }, [userLocation]);

  // Add seller markers when sellers change
  useEffect(() => {
    if (!mapInstance.current || loading) return;

    // Clear existing seller markers
    markersRef.current.forEach(marker => {
      if (marker instanceof L.Marker) {
        mapInstance.current?.removeLayer(marker);
      }
    });
    markersRef.current = markersRef.current.filter(m => {
      if (userLocation && m.getLatLng().lat === userLocation.lat) {
        return true; // Keep user location marker
      }
      return false;
    });

    // Add seller markers
    sellers.forEach((seller) => {
      const isRetailer = seller.role === 'retailer';
      const markerColor = isRetailer ? 'hsl(var(--secondary))' : 'hsl(var(--accent))';
      
      const sellerMarker = L.marker([seller.location_lat, seller.location_lng], {
        icon: L.divIcon({
          className: 'seller-marker',
          html: `<div style="width: 30px; height: 30px; border-radius: 50%; background-color: ${markerColor}; border: 2px solid white; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">${seller.role === 'retailer' ? 'R' : 'W'}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        })
      }).addTo(mapInstance.current!);

      sellerMarker.on('click', () => {
        setSelectedSeller(seller);
        if (onSellerSelect) {
          onSellerSelect(seller.id);
        }
      });

      markersRef.current.push(sellerMarker);
    });
  }, [sellers, loading, userLocation, onSellerSelect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full">
      <div className="relative h-[600px] w-full">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm rounded-lg z-[1000]">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}
        <div 
          ref={mapContainer} 
          className="w-full h-full rounded-lg border shadow-lg"
          style={{ minHeight: '600px' }}
        />
        
        {sellers.length === 0 && !loading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg border z-[1000]">
            <p className="text-sm text-muted-foreground">
              No sellers found with location data
            </p>
          </div>
        )}
      </div>
      
      {selectedSeller && (
        <Card className="absolute top-4 right-4 p-4 max-w-xs shadow-xl z-[1000]">
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

      <div className="absolute bottom-4 left-4 bg-card p-3 rounded-lg shadow-lg border z-[1000]">
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
