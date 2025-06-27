
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { placeId, sessionToken } = await req.json();
    
    console.log('🔍 Places Details request:', { placeId, sessionToken });

    if (!placeId) {
      throw new Error('Place ID is required');
    }

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      throw new Error('Google API key not configured');
    }

    console.log('📍 Making request to Google Places Details API...');

    // Build request body for Google Places Details (New)
    const requestBody = {
      placeId,
      sessionToken,
      languageCode: 'en'
    };

    const response = await fetch('https://places.googleapis.com/v1/places/' + placeId, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,types,rating,photos'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Google Places Details API error:', response.status, errorText);
      throw new Error(`Google Places Details API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Google Places Details API response received');

    // Convert to legacy format for compatibility
    const legacyFormat = {
      result: {
        place_id: data.id,
        name: data.displayName?.text,
        formatted_address: data.formattedAddress,
        geometry: {
          location: {
            lat: data.location?.latitude,
            lng: data.location?.longitude
          }
        },
        types: data.types || [],
        rating: data.rating,
        photos: data.photos?.map((photo: any) => ({
          photo_reference: photo.name,
          height: photo.heightPx,
          width: photo.widthPx
        })) || []
      }
    };

    return new Response(JSON.stringify(legacyFormat), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in google-places-details function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      result: null
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
