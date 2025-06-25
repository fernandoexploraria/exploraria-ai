
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { placeId, maxWidth = 800, quality = 'medium' } = await req.json();
    
    if (!placeId) {
      return new Response(
        JSON.stringify({ error: 'placeId is required' }),
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

    console.log(`[PLACES-PHOTOS-V2] Fetching photos for place: ${placeId}, quality: ${quality}, maxWidth: ${maxWidth}`);

    // Try Places API v2 first, fallback to legacy API if it fails
    let placeData = null;
    let apiVersion = 'v2';

    try {
      // Use Places API v2 with field masking for cost optimization
      const placeDetailsUrl = `https://places.googleapis.com/v1/places/${placeId}?fields=photos&key=${GOOGLE_API_KEY}`;
      
      const placeResponse = await fetch(placeDetailsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!placeResponse.ok) {
        console.log(`[PLACES-PHOTOS-V2] Places API v2 failed with status: ${placeResponse.status}, trying legacy API`);
        throw new Error(`Places API v2 error: ${placeResponse.status}`);
      }

      placeData = await placeResponse.json();
      console.log(`[PLACES-PHOTOS-V2] Successfully used Places API v2`);
    } catch (v2Error) {
      console.log(`[PLACES-PHOTOS-V2] Places API v2 failed: ${v2Error.message}, falling back to legacy API`);
      
      // Fallback to legacy Places API
      try {
        const legacyUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_API_KEY}`;
        
        const legacyResponse = await fetch(legacyUrl);
        
        if (!legacyResponse.ok) {
          console.error(`[PLACES-PHOTOS-V2] Legacy API also failed with status: ${legacyResponse.status}`);
          throw new Error(`Legacy Places API error: ${legacyResponse.status}`);
        }

        const legacyData = await legacyResponse.json();
        
        if (legacyData.status !== 'OK') {
          console.error(`[PLACES-PHOTOS-V2] Legacy API returned status: ${legacyData.status}`);
          throw new Error(`Legacy Places API status: ${legacyData.status}`);
        }

        // Convert legacy format to v2 format
        placeData = {
          photos: legacyData.result?.photos?.map((photo: any) => ({
            name: `places/${placeId}/photos/${photo.photo_reference}`,
            widthPx: photo.width,
            heightPx: photo.height,
            authorAttributions: photo.html_attributions?.map((attr: string) => ({
              displayName: attr.replace(/<[^>]*>/g, '') // Strip HTML tags
            })) || []
          })) || []
        };
        
        apiVersion = 'legacy';
        console.log(`[PLACES-PHOTOS-V2] Successfully used legacy Places API`);
      } catch (legacyError) {
        console.error(`[PLACES-PHOTOS-V2] Both APIs failed. Legacy error: ${legacyError.message}`);
        throw new Error(`Both Places APIs failed: ${legacyError.message}`);
      }
    }

    console.log(`[PLACES-PHOTOS-V2] Place data received using ${apiVersion}:`, placeData);

    if (!placeData.photos || placeData.photos.length === 0) {
      console.log(`[PLACES-PHOTOS-V2] No photos found for place: ${placeId}`);
      return new Response(
        JSON.stringify({ photos: [], message: 'No photos available' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Process photos with different sizes for progressive loading
    const processedPhotos = placeData.photos.slice(0, 5).map((photo: any, index: number) => {
      let photoReference;
      
      if (apiVersion === 'v2') {
        photoReference = photo.name;
      } else {
        // For legacy API, extract photo_reference from the converted format
        photoReference = photo.name.split('/').pop() || photo.name;
      }
      
      // Generate different sizes for progressive loading
      const sizes = {
        thumb: 200,
        medium: 600,
        large: Math.min(maxWidth, 1200)
      };

      const photoUrls = Object.entries(sizes).reduce((acc, [sizeKey, width]) => {
        if (apiVersion === 'v2') {
          acc[sizeKey] = `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=${width}&key=${GOOGLE_API_KEY}`;
        } else {
          // Use legacy photo URL format
          acc[sizeKey] = `https://maps.googleapis.com/maps/api/place/photo?photoreference=${photoReference}&maxwidth=${width}&key=${GOOGLE_API_KEY}`;
        }
        return acc;
      }, {} as Record<string, string>);

      return {
        id: index,
        photoReference,
        urls: photoUrls,
        attributions: photo.authorAttributions || [],
        width: photo.widthPx || sizes.large,
        height: photo.heightPx || Math.round(sizes.large * 0.75)
      };
    });

    console.log(`[PLACES-PHOTOS-V2] Processed ${processedPhotos.length} photos for place: ${placeId} using ${apiVersion} API`);

    return new Response(
      JSON.stringify({
        photos: processedPhotos,
        placeId,
        totalPhotos: placeData.photos.length,
        apiVersion
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[PLACES-PHOTOS-V2] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch photos',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
