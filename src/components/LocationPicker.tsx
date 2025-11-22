import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, MapPin } from "lucide-react";
import { reverseGeocode, type AddressComponents } from "@/lib/reverseGeocode";

// Fix for default marker icon in Leaflet - use CDN URLs for production compatibility
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LocationPickerProps {
  initialLat?: number | null;
  initialLng?: number | null;
  onLocationSelect: (lat: number, lng: number, address: string, addressComponents?: AddressComponents) => void;
  apiKey?: string; // Optional, not needed for Leaflet + OpenStreetMap
}

export const LocationPicker = ({
  initialLat,
  initialLng,
  onLocationSelect,
  apiKey,
}: LocationPickerProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
    addressComponents?: AddressComponents;
  } | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const loadMap = async () => {
      try {
        const defaultLat = initialLat || 28.6139;
        const defaultLng = initialLng || 77.2090;

        // Create map
        const map = L.map(mapContainerRef.current!, {
          center: [defaultLat, defaultLng],
          zoom: 15,
        });

        // Add OpenStreetMap tiles (free, no API key required)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;

        // Create draggable marker
        const marker = L.marker([defaultLat, defaultLng], {
          draggable: true,
          icon: L.divIcon({
            className: 'custom-draggable-marker',
            html: '<div style="width: 30px; height: 30px; border-radius: 50% 50% 50% 0; background-color: #3b82f6; border: 3px solid white; transform: rotate(-45deg); box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div><div style="width: 8px; height: 8px; border-radius: 50%; background-color: white; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>',
            iconSize: [30, 30],
            iconAnchor: [15, 30],
          })
        }).addTo(map);

        markerRef.current = marker;

        // Handle marker drag end
        marker.on("dragend", async (e) => {
          const latlng = marker.getLatLng();
          await handleReverseGeocode(latlng.lat, latlng.lng);
        });

        // Initial reverse geocode
        if (initialLat && initialLng) {
          await handleReverseGeocode(initialLat, initialLng);
        }

        // Also allow clicking on map to set location
        map.on("click", async (e) => {
          marker.setLatLng(e.latlng);
          await handleReverseGeocode(e.latlng.lat, e.latlng.lng);
        });

        setLoading(false);
      } catch (error) {
        console.error("Failed to load map:", error);
        setLoading(false);
      }
    };

    loadMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [initialLat, initialLng]);

  const handleReverseGeocode = async (lat: number, lng: number) => {
    try {
      const addressComponents = await reverseGeocode(lat, lng);
      
      setSelectedLocation({ 
        lat, 
        lng, 
        address: addressComponents?.formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        addressComponents: addressComponents || undefined
      });
    } catch (error) {
      console.error("Reverse geocode failed:", error);
      setSelectedLocation({ 
        lat, 
        lng, 
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` 
      });
    }
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onLocationSelect(
        selectedLocation.lat,
        selectedLocation.lng,
        selectedLocation.address,
        selectedLocation.addressComponents
      );
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="relative">
        <div
          ref={mapContainerRef}
          className="w-full h-[400px] rounded-lg overflow-hidden"
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-[1000]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      {selectedLocation && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
            <div>
              <p className="font-medium">Selected Location:</p>
              <p className="text-muted-foreground">{selectedLocation.address}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </p>
              {selectedLocation.addressComponents && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs font-medium mb-1">Address Details:</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {selectedLocation.addressComponents.area && <p><span className="font-medium">Area:</span> {selectedLocation.addressComponents.area}</p>}
                    {selectedLocation.addressComponents.city && <p><span className="font-medium">City:</span> {selectedLocation.addressComponents.city}</p>}
                    {selectedLocation.addressComponents.district && <p><span className="font-medium">District:</span> {selectedLocation.addressComponents.district}</p>}
                    {selectedLocation.addressComponents.state && <p><span className="font-medium">State:</span> {selectedLocation.addressComponents.state}</p>}
                    {selectedLocation.addressComponents.country && <p><span className="font-medium">Country:</span> {selectedLocation.addressComponents.country}</p>}
                    {selectedLocation.addressComponents.pincode && <p><span className="font-medium">Pincode:</span> {selectedLocation.addressComponents.pincode}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
          <Button onClick={handleConfirm} className="w-full">
            Confirm Location
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Drag the marker or click on the map to select your exact location
      </p>
    </Card>
  );
};
