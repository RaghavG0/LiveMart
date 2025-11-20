import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, MapPin } from "lucide-react";

interface LocationPickerProps {
  initialLat?: number | null;
  initialLng?: number | null;
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  apiKey: string;
}

export const LocationPicker = ({
  initialLat,
  initialLng,
  onLocationSelect,
  apiKey,
}: LocationPickerProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const loadMap = async () => {
      try {
        // Check if OlaMaps SDK is loaded
        // @ts-ignore - OlaMaps is loaded from CDN
        if (typeof window.OlaMaps === 'undefined') {
          console.error('OlaMaps SDK not loaded. Make sure the script is included in index.html');
          setLoading(false);
          return;
        }

        // @ts-ignore
        const olaMaps = new window.OlaMaps({ apiKey });

        const defaultLat = initialLat || 28.6139;
        const defaultLng = initialLng || 77.2090;

        const map = olaMaps.init({
          container: mapContainerRef.current,
          center: [defaultLng, defaultLat],
          zoom: 15,
          style: "https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json",
        });

        mapInstanceRef.current = map;

        // Add draggable marker
        const marker = olaMaps
          .addMarker({
            color: "#3b82f6",
            draggable: true,
          })
          .setLngLat([defaultLng, defaultLat])
          .addTo(map);

        markerRef.current = marker;

        // Handle marker drag end
        marker.on("dragend", async () => {
          const lngLat = marker.getLngLat();
          await reverseGeocode(lngLat.lat, lngLat.lng);
        });

        // Initial reverse geocode
        if (initialLat && initialLng) {
          await reverseGeocode(initialLat, initialLng);
        }

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
      }
    };
  }, [apiKey, initialLat, initialLng]);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lng}&api_key=${apiKey}`
      );
      const data = await response.json();
      
      const address = data.results?.[0]?.formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      
      setSelectedLocation({ lat, lng, address });
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
        selectedLocation.address
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
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
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
            </div>
          </div>
          <Button onClick={handleConfirm} className="w-full">
            Confirm Location
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Drag the marker to select your exact location
      </p>
    </Card>
  );
};
