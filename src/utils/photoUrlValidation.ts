
/**
 * Robust validation function for Google Places Photo API URLs
 * Based on Google Places API (New) URL format requirements
 */
export const isValidGooglePlacesPhotoUrl = (url: string): { isValid: boolean; error?: string } => {
  try {
    const parsedUrl = new URL(url);

    // 1. Check Protocol
    if (parsedUrl.protocol !== 'https:') {
      return { isValid: false, error: "Invalid protocol (must be https)" };
    }

    // 2. Check Hostname
    if (parsedUrl.hostname !== 'places.googleapis.com') {
      return { isValid: false, error: "Invalid hostname (must be places.googleapis.com)" };
    }

    // 3. Check Base Path and Resource Name Pattern
    // Expected path: /v1/places/{placeId}/photos/{photo_reference}/media
    const pathSegments = parsedUrl.pathname.split('/');
    if (pathSegments.length < 7 ||
        pathSegments[1] !== 'v1' ||
        pathSegments[2] !== 'places' ||
        pathSegments[4] !== 'photos' ||
        pathSegments[6] !== 'media') {
      return { isValid: false, error: "Invalid path structure or missing 'media' endpoint" };
    }

    // 4. Check Query Parameters
    const hasKey = parsedUrl.searchParams.has('key');
    const hasMaxWidthPx = parsedUrl.searchParams.has('maxWidthPx');
    const hasMaxHeightPx = parsedUrl.searchParams.has('maxHeightPx');

    if (!hasKey) {
      return { isValid: false, error: "Missing 'key' parameter" };
    }
    if (!hasMaxWidthPx && !hasMaxHeightPx) {
      return { isValid: false, error: "Missing required 'maxWidthPx' or 'maxHeightPx' parameter" };
    }

    // 5. Validate Pixel Values
    if (hasMaxWidthPx) {
      const width = parseInt(parsedUrl.searchParams.get('maxWidthPx') || '0', 10);
      if (isNaN(width) || width < 1 || width > 4800) {
        return { isValid: false, error: "Invalid maxWidthPx value (must be 1-4800)" };
      }
    }
    if (hasMaxHeightPx) {
      const height = parseInt(parsedUrl.searchParams.get('maxHeightPx') || '0', 10);
      if (isNaN(height) || height < 1 || height > 4800) {
        return { isValid: false, error: "Invalid maxHeightPx value (must be 1-4800)" };
      }
    }

    return { isValid: true };

  } catch (error) {
    return { isValid: false, error: `URL parsing error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
};

/**
 * Legacy validation function for backward compatibility
 * Now uses the robust Google Places Photo URL validation
 */
export const isValidUrl = (url: string): boolean => {
  // For Google Places Photo URLs, use the robust validation
  if (url.includes('places.googleapis.com')) {
    const result = isValidGooglePlacesPhotoUrl(url);
    // Only log warnings for severe validation failures, not parameter format issues
    if (!result.isValid && result.error && 
        !result.error.includes('maxWidthPx') && 
        !result.error.includes('maxHeightPx') &&
        !result.error.includes('parameter')) {
      console.warn(`❌ Google Places Photo URL validation failed: ${result.error}`, url);
    }
    return result.isValid;
  }

  // For other URLs, use basic validation
  try {
    new URL(url);
    return url.includes('http');
  } catch {
    return false;
  }
};
