
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
      console.error('❌ GOOGLE_API_KEY not found in environment');
      throw new Error('Google API key not configured');
    }

    console.log('✅ Google API key found (length:', GOOGLE_API_KEY.length, ')');

    // Search for the place using Places Text Search
    const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(landmarkName)}&location=${coordinates[1]},${coordinates[0]}&radius=1000&key=${GOOGLE_API_KEY}`;
    
    console.log('🌐 Making Google Places API request...');
    console.log('URL (masked):', textSearchUrl.replace(GOOGLE_API_KEY, '[MASKED]'));
    
    const response = await fetch(textSearchUrl);
    console.log('📡 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      console.error('❌ HTTP Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error body:', errorText);
      throw new Error(`Google Places API HTTP error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('📋 API Response Status:', data.status);
    
    if (data.status === 'REQUEST_DENIED') {
      console.error('❌ REQUEST_DENIED - API Key Issues:');
      console.error('- Error message:', data.error_message);
      console.error('- Check: API key restrictions in Google Cloud Console');
      console.error('- Check: Places API is enabled');
      console.error('- Check: Billing is set up');
      console.error('- Check: API restrictions allow requests from Supabase domain');
    } else if (data.status === 'ZERO_RESULTS') {
      console.log('⚠️ No results found for:', landmarkName);
    } else if (data.status === 'OVER_QUERY_LIMIT') {
      console.error('❌ Over query limit - check billing');
    } else if (data.status === 'INVALID_REQUEST') {
      console.error('❌ Invalid request - check parameters');
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
      } else {
        console.log('⚠️ Place found but no photos available');
      }
    }

    // Return fallback if no photo found or API issues
    console.log('🔄 Using fallback image for:', landmarkName);
    const seed = landmarkName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const fallbackUrl = `https://picsum.photos/seed/${seed}/400/300`;
    
    return new Response(
      JSON.stringify({ success: true, imageUrl: fallbackUrl, source: 'fallback', apiStatus: data.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Error in fetch-landmark-image function:', error);
    
    // Return fallback on error
    try {
      const { landmarkName } = await req.json().catch(() => ({ landmarkName: 'unknown' }));
      const seed = landmarkName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
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
    } catch (fallbackError) {
      console.error('💥 Fallback error:', fallbackError);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  }
});
