/**
 * Reverse geocoding utility to extract address components from coordinates
 */

export interface AddressComponents {
  formatted_address: string;
  area?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

/**
 * Extract address components from Ola Maps reverse geocode response
 * Maps the API response to our address component structure
 */
export function extractAddressComponents(data: any): AddressComponents {
  const result = data.results?.[0];
  if (!result) {
    return {
      formatted_address: '',
      area: undefined,
      city: undefined,
      district: undefined,
      state: undefined,
      country: undefined,
      pincode: undefined,
    };
  }

  const components: AddressComponents = {
    formatted_address: result.formatted_address || '',
    area: undefined,
    city: undefined,
    district: undefined,
    state: undefined,
    country: undefined,
    pincode: undefined,
  };

  // Extract address components from address_components array
  if (result.address_components && Array.isArray(result.address_components)) {
    for (const component of result.address_components) {
      const types = component.types || [];
      const longName = component.long_name || component.short_name;
      
      // Extract area/locality (prioritize sublocality_level_1, then sublocality, then neighborhood)
      if (!components.area) {
        if (types.includes('sublocality_level_1')) {
          components.area = longName;
        } else if (types.includes('sublocality') && !components.area) {
          components.area = longName;
        } else if (types.includes('neighborhood') && !components.area) {
          components.area = longName;
        }
      }
      
      // Extract city (prioritize locality, then administrative_area_level_2)
      if (!components.city) {
        if (types.includes('locality')) {
          components.city = longName;
        } else if (types.includes('administrative_area_level_2') && !components.city) {
          components.city = longName;
        }
      }
      
      // Extract district (administrative_area_level_2, but not if already used as city)
      if (!components.district && types.includes('administrative_area_level_2')) {
        components.district = longName;
      }
      
      // Extract state (administrative_area_level_1)
      if (!components.state && types.includes('administrative_area_level_1')) {
        components.state = longName;
      }
      
      // Extract country
      if (!components.country && types.includes('country')) {
        components.country = longName;
      }
      
      // Extract pincode/postal_code
      if (!components.pincode && types.includes('postal_code')) {
        components.pincode = longName;
      }
    }
  }

  // Fallback: Try to extract from formatted_address if components are missing
  if (!components.city && result.formatted_address) {
    // Try to parse city from formatted address (usually after locality)
    const parts = result.formatted_address.split(',');
    if (parts.length > 1) {
      components.city = parts[parts.length - 2]?.trim();
    }
  }

  return components;
}

/**
 * Perform reverse geocoding using Ola Maps API
 * Returns address components including area, city, district, state, country, pincode
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  apiKey: string
): Promise<AddressComponents> {
  try {
    const response = await fetch(
      `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lng}&api_key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Reverse geocode API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      // Fallback to coordinates if no address found
      return {
        formatted_address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        area: undefined,
        city: undefined,
        district: undefined,
        state: undefined,
        country: undefined,
        pincode: undefined,
      };
    }

    return extractAddressComponents(data);
  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    // Fallback to coordinates
    return {
      formatted_address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      area: undefined,
      city: undefined,
      district: undefined,
      state: undefined,
      country: undefined,
      pincode: undefined,
    };
  }
}

