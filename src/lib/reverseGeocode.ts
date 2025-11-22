import { toast } from "sonner";

interface AddressComponents {
  formatted_address: string;
  area: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
}

// Helper to extract address components from Nominatim API response
function extractAddressComponents(result: any): AddressComponents {
  const address = result.address || {};
  const components: AddressComponents = {
    formatted_address: result.display_name || '',
    area: address.neighbourhood || address.suburb || address.village || null,
    city: address.city || address.town || address.municipality || address.county || null,
    district: address.state_district || address.district || null,
    state: address.state || address.region || null,
    country: address.country || null,
    pincode: address.postcode || null,
  };

  return components;
}

/**
 * Reverse geocode coordinates to get full address using Nominatim (OpenStreetMap)
 * Free service, no API key required
 */
export async function reverseGeocode(lat: number, lng: number, apiKey?: string): Promise<AddressComponents | null> {
  try {
    // Use Nominatim (OpenStreetMap) - free, no API key required
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'LiveMart/1.0', // Required by Nominatim
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.lat && data.lon) {
      return extractAddressComponents(data);
    } else {
      toast.error("Could not find address for this location.");
      return null;
    }
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    toast.error("Failed to get address details. Please try again.");
    return null;
  }
}

/**
 * Forward geocode address to get coordinates using Nominatim (OpenStreetMap)
 * Free service, no API key required
 */
export async function forwardGeocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'LiveMart/1.0', // Required by Nominatim
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    } else {
      toast.error("Could not find coordinates for this address.");
      return null;
    }
  } catch (error) {
    console.error("Forward geocoding failed:", error);
    toast.error("Failed to geocode address. Please try again.");
    return null;
  }
}
