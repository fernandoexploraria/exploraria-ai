
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

    // Use Places API v2 with field masking for cost optimization
    const placeDetailsUrl = `https://places.googleapis.com/v1/places/${placeId}?fields=photos&key=${GOOGLE_API_KEY}`;
    
    const placeResponse = await fetch(placeDetailsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!placeResponse.ok) {
      console.error(`Place Details API error: ${placeResponse.status}`);
      throw new Error(`Place Details API error: ${placeResponse.status}`);
    }

    const placeData = await placeResponse.json();
    console.log(`[PLACES-PHOTOS-V2] Place data received:`, placeData);

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
      const photoReference = photo.name;
      
      // Generate different sizes for progressive loading
      const sizes = {
        thumb: 200,
        medium: 600,
        large: Math.min(maxWidth, 1200)
      };

      const photoUrls = Object.entries(sizes).reduce((acc, [sizeKey, width]) => {
        acc[sizeKey] = `https://places.googleapis.com/v1/${photoReference}/media?maxWidthPx=${width}&key=${GOOGLE_API_KEY}`;
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

    console.log(`[PLACES-PHOTOS-V2] Processed ${processedPhotos.length} photos for place: ${placeId}`);

    return new Response(
      JSON.stringify({
        photos: processedPhotos,
        placeId,
        totalPhotos: placeData.photos.length
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
