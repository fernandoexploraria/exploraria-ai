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
    const { place_id, from_coordinates, travel_mode = 'WALKING' } = await req.json();
    
    if (!place_id) {
      return new Response(
        JSON.stringify({ error: 'place_id is required' }),
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

    console.log(`[GET-PLACE-DIRECTIONS] Getting directions to place_id: ${place_id}`);

    // First, get the place details to get coordinates
    const placeDetailsUrl = `https://places.googleapis.com/v1/places/${place_id}?fields=location,displayName,formattedAddress&key=${GOOGLE_API_KEY}`;
    
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
    const destination = placeData.location;
    
    if (!destination || !destination.latitude || !destination.longitude) {
      throw new Error('Could not get destination coordinates');
    }

    // If no from_coordinates provided, we'll return general location info
    if (!from_coordinates || !from_coordinates.latitude || !from_coordinates.longitude) {
      const result = {
        place_id,
        place_name: placeData.displayName?.text || 'Unknown place',
        destination_address: placeData.formattedAddress || 'Address not available',
        destination_coordinates: {
          latitude: destination.latitude,
          longitude: destination.longitude
        },
        message: 'To get precise directions, I would need your current location. The destination is located at the coordinates provided.',
        has_directions: false
      };

      return new Response(
        JSON.stringify(result),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Use Google Routes API for directions
    const routesUrl = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    
    const routeRequest = {
      origin: {
        location: {
          latLng: {
            latitude: from_coordinates.latitude,
            longitude: from_coordinates.longitude
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.latitude,
            longitude: destination.longitude
          }
        }
      },
      travelMode: travel_mode,
      routingPreference: 'TRAFFIC_AWARE',
      computeAlternativeRoutes: false,
      routeModifiers: {
        avoidTolls: false,
        avoidHighways: false,
        avoidFerries: false
      },
      languageCode: 'en-US',
      units: 'IMPERIAL'
    };

    const routeResponse = await fetch(routesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.legs.steps.navigationInstruction,routes.legs.distanceMeters,routes.legs.duration'
      },
      body: JSON.stringify(routeRequest)
    });

    if (!routeResponse.ok) {
      console.error(`Routes API error: ${routeResponse.status}`);
      const errorText = await routeResponse.text();
      console.error('Routes API error details:', errorText);
      throw new Error(`Routes API error: ${routeResponse.status}`);
    }

    const routeData = await routeResponse.json();
    console.log(`[GET-PLACE-DIRECTIONS] Route data received`);

    if (!routeData.routes || routeData.routes.length === 0) {
      throw new Error('No routes found');
    }

    const route = routeData.routes[0];
    const leg = route.legs?.[0];

    // Extract key navigation steps
    const steps = leg?.steps?.slice(0, 5).map((step: any) => 
      step.navigationInstruction?.instructions || 'Continue on route'
    ) || [];

    const result = {
      place_id,
      place_name: placeData.displayName?.text || 'Unknown place',
      destination_address: placeData.formattedAddress || 'Address not available',
      travel_mode: travel_mode.toLowerCase(),
      distance: {
        meters: route.distanceMeters || 0,
        text: route.distanceMeters ? `${(route.distanceMeters / 1609.34).toFixed(1)} miles` : 'Unknown distance'
      },
      duration: {
        seconds: route.duration?.replace('s', '') || 0,
        text: route.duration ? `${Math.ceil(parseInt(route.duration.replace('s', '')) / 60)} minutes` : 'Unknown duration'
      },
      key_steps: steps,
      summary: `${travel_mode.toLowerCase() === 'walking' ? 'Walk' : 'Drive'} ${route.distanceMeters ? `${(route.distanceMeters / 1609.34).toFixed(1)} miles` : ''} to reach ${placeData.displayName?.text || 'your destination'}${route.duration ? ` (approximately ${Math.ceil(parseInt(route.duration.replace('s', '')) / 60)} minutes)` : ''}.`,
      has_directions: true
    };

    console.log(`[GET-PLACE-DIRECTIONS] Returning directions: ${result.distance.text}, ${result.duration.text}`);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[GET-PLACE-DIRECTIONS] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to get directions',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});