
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
    const { input, sessionToken, userLocation } = await req.json();
    
    console.log('🔍 Places Autocomplete request:', { input, sessionToken, userLocation });

    if (!input || input.trim().length < 2) {
      return new Response(JSON.stringify({ predictions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      throw new Error('Google API key not configured');
    }

    // Build request body for Google Places Autocomplete (New)
    const requestBody: any = {
      input: input.trim(),
      sessionToken,
      languageCode: 'en',
      includedPrimaryTypes: [
        // Geographic/Administrative areas
        'administrative_area_level_1',
        'administrative_area_level_2', 
        'locality',
        'sublocality',
        'political',
        // Tourist destinations and landmarks
        'tourist_attraction',
        'museum',
        'park',
        'landmark',
        'stadium',
        'amusement_park',
        'zoo',
        'aquarium',
        'art_gallery',
        'historical_place',
        'cultural_landmark',
        'monument',
        'performing_arts_theater',
        'national_park',
        'historical_landmark',
        'visitor_center',
        'botanical_garden',
        'plaza',
        'library',
        'university'
      ]
    };

    // Add location bias if user location is provided
    if (userLocation && userLocation.latitude && userLocation.longitude) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude
          },
          radius: 50000 // 50km radius
        }
      };
    }

    console.log('📍 Making request to Google Places Autocomplete API...');

    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.types'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Google Places API error:', response.status, errorText);
      throw new Error(`Google Places API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Google Places API response received:', data.suggestions?.length || 0, 'suggestions');

    // Helper function to parse main and secondary text from the full text
    const parseLocationText = (fullText: string) => {
      // Split by comma to separate main location from details
      const parts = fullText.split(',').map(part => part.trim());
      
      if (parts.length >= 2) {
        return {
          mainText: parts[0],
          secondaryText: parts.slice(1).join(', ')
        };
      } else {
        return {
          mainText: fullText,
          secondaryText: ''
        };
      }
    };

    // Format suggestions for frontend (convert to predictions format for compatibility)
    const formattedPredictions = data.suggestions?.map((suggestion: any) => {
      const fullText = suggestion.placePrediction.text.text;
      const { mainText, secondaryText } = parseLocationText(fullText);
      
      return {
        placeId: suggestion.placePrediction.placeId,
        text: fullText,
        mainText: mainText,
        secondaryText: secondaryText,
        types: suggestion.placePrediction.types || []
      };
    }) || [];

    return new Response(JSON.stringify({ predictions: formattedPredictions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in google-places-autocomplete function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      predictions: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
