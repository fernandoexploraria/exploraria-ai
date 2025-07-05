
/**
 * Decodes a Google Maps encoded polyline string into an array of coordinates
 * @param encoded - The encoded polyline string from Google Routes API
 * @returns Array of [longitude, latitude] pairs for Mapbox
 */
export const decodePolyline = (encoded: string): [number, number][] => {
  if (!encoded) {
    console.warn('Empty polyline provided to decoder');
    return [];
  }

  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  try {
    while (index < encoded.length) {
      let b: number;
      let shift = 0;
      let result = 0;
      
      // Decode latitude
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      
      const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += deltaLat;

      shift = 0;
      result = 0;
      
      // Decode longitude
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      
      const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
      lng += deltaLng;

      // Convert to decimal degrees and push as [lng, lat] for Mapbox
      coordinates.push([lng / 1e5, lat / 1e5]);
    }
  } catch (error) {
    console.error('Error decoding polyline:', error);
    return [];
  }

  console.log(`🗺️ Decoded polyline: ${coordinates.length} coordinate points`);
  return coordinates;
};

/**
 * Creates a GeoJSON LineString from decoded coordinates
 * @param coordinates - Array of [longitude, latitude] pairs
 * @returns GeoJSON LineString object for Mapbox
 */
export const createRouteGeoJSON = (coordinates: [number, number][]) => {
  return {
    type: 'LineString' as const,
    coordinates
  };
};
