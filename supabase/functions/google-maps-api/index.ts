
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    if (req.method !== 'GET') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      });
    }

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    
    if (!googleApiKey) {
      console.error('GOOGLE_API_KEY not found in environment variables');
      return new Response('Google API key not configured', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Get the libraries parameter from the URL
    const url = new URL(req.url);
    const libraries = url.searchParams.get('libraries') || '';
    
    // Build the Google Maps JavaScript API URL with the secure API key
    const googleMapsApiUrl = `https://maps.googleapis.com/maps/api/js?key=${googleApiKey}${libraries ? `&libraries=${libraries}` : ''}`;
    
    console.log(`🗺️ Serving Google Maps API with libraries: ${libraries}`);

    // Fetch the Google Maps JavaScript API
    const response = await fetch(googleMapsApiUrl);
    
    if (!response.ok) {
      console.error(`Failed to fetch Google Maps API: ${response.status} ${response.statusText}`);
      return new Response('Failed to load Google Maps API', { 
        status: response.status, 
        headers: corsHeaders 
      });
    }

    const jsContent = await response.text();

    // Return the JavaScript content with proper headers
    return new Response(jsContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      }
    });

  } catch (error) {
    console.error('❌ Error in google-maps-api function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
