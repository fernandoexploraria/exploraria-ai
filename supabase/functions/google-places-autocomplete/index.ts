
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
        'locality',
        'tourist_attraction',
        'museum',
        'park',
        'sublocality'
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

    // Hierarchical sorting function
    const sortPredictionsByHierarchy = (suggestions: any[]) => {
      // Define type priority hierarchy (lower number = higher priority)
      const typePriority: { [key: string]: number } = {
        'locality': 1,
        'sublocality': 2,
        'tourist_attraction': 3,
        'museum': 4,
        'park': 5,
        // Fallback priorities for other types
        'administrative_area_level_1': 6,
        'administrative_area_level_2': 7,
        'political': 8
      };

      return suggestions.map((suggestion, originalIndex) => {
        let highestPriority = 999; // Default low priority
        let matchedType = null;

        if (suggestion.placePrediction?.types) {
          for (const type of suggestion.placePrediction.types) {
            const priority = typePriority[type];
            if (priority !== undefined && priority < highestPriority) {
              highestPriority = priority;
              matchedType = type;
            }
          }
        }

        return {
          suggestion,
          priority: highestPriority,
          matchedType,
          originalIndex
        };
      })
      .sort((a, b) => {
        // Primary sort: by type priority (lower number = higher priority)
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        // Secondary sort: maintain original Google relevance order
        return a.originalIndex - b.originalIndex;
      })
      .map(item => item.suggestion);
    };

    // Sort suggestions by hierarchy before formatting
    const sortedSuggestions = data.suggestions ? sortPredictionsByHierarchy(data.suggestions) : [];

    // Format suggestions for frontend (convert to predictions format for compatibility)
    const formattedPredictions = sortedSuggestions.map((suggestion: any) => {
      const fullText = suggestion.placePrediction.text.text;
      const { mainText, secondaryText } = parseLocationText(fullText);
      
      return {
        placeId: suggestion.placePrediction.placeId,
        text: fullText,
        mainText: mainText,
        secondaryText: secondaryText,
        types: suggestion.placePrediction.types || []
      };
    });

    console.log('🔄 Sorted predictions by hierarchy:', formattedPredictions.length, 'results');

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
