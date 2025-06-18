
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { landmarkName, coordinates } = await req.json();
    console.log('Fetching image for landmark:', landmarkName, 'at coordinates:', coordinates);

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_API_KEY) {
      console.error('Google API key not found in environment variables');
      throw new Error('Google API key not configured');
    }

    console.log('Google API key found, making request...');

    // Search for the place using Places Text Search
    const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(landmarkName)}&location=${coordinates[1]},${coordinates[0]}&radius=1000&key=${GOOGLE_API_KEY}`;
    
    console.log('Making Google Places API request to:', textSearchUrl.replace(GOOGLE_API_KEY, '[API_KEY_HIDDEN]'));
    const response = await fetch(textSearchUrl);
    
    if (!response.ok) {
      console.error(`Google Places API HTTP error: ${response.status} ${response.statusText}`);
      throw new Error(`Google Places API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Google Places API response status:', data.status);
    console.log('Google Places API response:', JSON.stringify(data, null, 2));
    
    if (data.status === 'REQUEST_DENIED') {
      console.error('REQUEST_DENIED - Check API key restrictions and billing');
      console.error('Error message:', data.error_message);
    }
    
    if (data.status === 'OK' && data.results.length > 0) {
      const place = data.results[0];
      console.log('Found place:', place.name, 'Photos available:', place.photos?.length || 0);
      
      if (place.photos && place.photos.length > 0) {
        const photoReference = place.photos[0].photo_reference;
        const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${GOOGLE_API_KEY}`;
        
        console.log('Found Google Places photo for:', landmarkName);
        return new Response(
          JSON.stringify({ success: true, imageUrl: photoUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Return fallback if no photo found or API issues
    console.log('No Google Places photo found or API error, using fallback for:', landmarkName);
    const seed = landmarkName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const fallbackUrl = `https://picsum.photos/seed/${seed}/400/300`;
    
    return new Response(
      JSON.stringify({ success: true, imageUrl: fallbackUrl, isFallback: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-landmark-image function:', error);
    
    // Return fallback on error
    try {
      const { landmarkName } = await req.json().catch(() => ({ landmarkName: 'unknown' }));
      const seed = landmarkName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const fallbackUrl = `https://picsum.photos/seed/${seed}/400/300`;
      
      return new Response(
        JSON.stringify({ success: true, imageUrl: fallbackUrl, isFallback: true, error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (fallbackError) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  }
});
