
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
    console.log('=== FETCH LANDMARK IMAGE DEBUG ===');
    console.log('Landmark:', landmarkName);
    console.log('Coordinates:', coordinates);

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_API_KEY) {
      console.log('⚠️ No Google API key found, using fallback image');
      const seed = landmarkName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const fallbackUrl = `https://picsum.photos/seed/${seed}/400/300`;
      
      return new Response(
        JSON.stringify({ success: true, imageUrl: fallbackUrl, source: 'fallback-no-key' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Google API key found, attempting Places API request');

    // Try Google Places API with better error handling
    const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(landmarkName)}&location=${coordinates[1]},${coordinates[0]}&radius=1000&key=${GOOGLE_API_KEY}`;
    
    console.log('🌐 Making Google Places API request...');
    
    const response = await fetch(textSearchUrl);
    console.log('📡 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      console.error('❌ HTTP Error:', response.status, response.statusText);
      throw new Error(`Google Places API HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('📋 API Response Status:', data.status);
    
    // Handle different API response statuses
    if (data.status === 'REQUEST_DENIED') {
      console.error('❌ Google Places API Request Denied');
      console.error('- Error:', data.error_message);
      console.error('- This usually means API key restrictions or billing issues');
      console.error('- Falling back to placeholder image');
      
      // Use a more descriptive fallback for API key issues
      const seed = landmarkName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const fallbackUrl = `https://picsum.photos/seed/${seed}/400/300`;
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          imageUrl: fallbackUrl, 
          source: 'fallback-api-denied',
          message: 'Google API access denied - check API key configuration'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const place = data.results[0];
      console.log('✅ Found place:', place.name);
      console.log('📷 Photos available:', place.photos?.length || 0);
      
      if (place.photos && place.photos.length > 0) {
        const photoReference = place.photos[0].photo_reference;
        const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${GOOGLE_API_KEY}`;
        
        console.log('✅ Returning Google Places photo');
        return new Response(
          JSON.stringify({ success: true, imageUrl: photoUrl, source: 'google-places' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fallback to seeded image for any other case
    console.log('🔄 Using fallback image for:', landmarkName);
    const seed = landmarkName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const fallbackUrl = `https://picsum.photos/seed/${seed}/400/300`;
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: fallbackUrl, 
        source: 'fallback-general',
        apiStatus: data.status 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Error in fetch-landmark-image function:', error);
    
    // Always return a working fallback image
    const seed = 'default-landmark';
    const fallbackUrl = `https://picsum.photos/seed/${seed}/400/300`;
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: fallbackUrl, 
        source: 'fallback-error',
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
