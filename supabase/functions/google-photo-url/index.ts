
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Robust validation function for Google Places Photo URLs
const isValidGooglePlacesPhotoUrl = (url: string): { isValid: boolean; error?: string } => {
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
    return { isValid: false, error: `URL parsing error: ${error.message}` };
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const { photoReference, size = 'medium', maxWidth } = await req.json();
    
    if (!photoReference) {
      return new Response(
        JSON.stringify({ error: 'photoReference is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_API_KEY) {
      console.error('Google API key not found');
      return new Response(
        JSON.stringify({ error: 'Google API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Determine appropriate width based on size
    let width = maxWidth;
    if (!width) {
      switch (size) {
        case 'thumb':
          width = 400;
          break;
        case 'medium':
          width = 800;
          break;
        case 'large':
          width = 1600;
          break;
        default:
          width = 800;
      }
    }

    console.log(`[GOOGLE-PHOTO-URL] Processing photo reference: ${photoReference}, size: ${size}, width: ${width}`);

    // Check if it's already a complete URL (fallback case)
    if (photoReference.startsWith('http://') || photoReference.startsWith('https://')) {
      console.log(`[GOOGLE-PHOTO-URL] Using complete URL as-is: ${photoReference}`);
      return new Response(
        JSON.stringify({ url: photoReference }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // NEW APPROACH: Use photo reference as-is from Google Places API (New)
    // The photoReference should be the full resource name like: places/{placeId}/photos/{photo_reference}
    // DO NOT clean or modify it - use it exactly as provided by Google Places API
    const fullResourceName = photoReference;
    
    // Construct Google Places API (New) URL using the full resource name
    const constructedUrl = `https://places.googleapis.com/v1/${fullResourceName}/media?maxWidthPx=${width}&key=${GOOGLE_API_KEY}`;
    
    console.log(`[GOOGLE-PHOTO-URL] Original photo reference: ${photoReference}`);
    console.log(`[GOOGLE-PHOTO-URL] Constructed URL: ${constructedUrl}`);

    // Server-side validation before returning URL
    const validation = isValidGooglePlacesPhotoUrl(constructedUrl);
    if (!validation.isValid) {
      console.error(`[GOOGLE-PHOTO-URL] Server-side validation failed: ${validation.error}`);
      console.error(`[GOOGLE-PHOTO-URL] Invalid URL: ${constructedUrl}`);
      
      return new Response(
        JSON.stringify({ 
          error: 'Invalid photo URL constructed',
          details: validation.error,
          originalReference: photoReference
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`[GOOGLE-PHOTO-URL] ✅ Server-side validation passed for: ${constructedUrl}`);

    return new Response(
      JSON.stringify({ url: constructedUrl }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[GOOGLE-PHOTO-URL] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to construct photo URL',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
