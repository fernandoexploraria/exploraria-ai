
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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

    console.log(`[GOOGLE-PHOTO-URL] Constructing URL for photo: ${photoReference}, size: ${size}, width: ${width}`);

    // Check if it's already a complete URL
    if (photoReference.startsWith('http://') || photoReference.startsWith('https://')) {
      console.log(`[GOOGLE-PHOTO-URL] Using complete URL: ${photoReference}`);
      return new Response(
        JSON.stringify({ url: photoReference }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Construct Google Places API URL
    const photoRefCleaned = photoReference.replace('places/', '').replace('/media', '');
    const constructedUrl = `https://places.googleapis.com/v1/${photoRefCleaned}/media?maxWidthPx=${width}&key=${GOOGLE_API_KEY}`;
    
    console.log(`[GOOGLE-PHOTO-URL] Constructed URL: ${constructedUrl}`);

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
