import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { place_id } = await req.json();
    
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

    // Get user's live location from database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required for directions',
          has_directions: false 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid authentication',
          has_directions: false 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Query user's latest location
    const { data: locationData, error: locationError } = await supabase
      .from('user_locations')
      .select('latitude, longitude, updated_at')
      .eq('user_id', userData.user.id)
      .single();

    if (locationError || !locationData) {
      console.log(`[GET-PLACE-DIRECTIONS] No location found for user: ${userData.user.id}`);
      return new Response(
        JSON.stringify({
          place_id,
          place_name: 'Destination',
          destination_address: 'Address not available',
          travel_mode: 'walking',
          distance: { meters: 0, text: 'Unknown distance' },
          duration: { seconds: 0, text: 'Unknown duration' },
          key_steps: [],
          summary: 'Location access required for directions. Please grant location permissions in your browser and try again.',
          has_directions: false,
          error: 'Location unavailable - please enable location access'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const from_coordinates = {
      latitude: locationData.latitude,
      longitude: locationData.longitude
    };

    console.log(`[GET-PLACE-DIRECTIONS] Using live user coordinates: ${from_coordinates.latitude}, ${from_coordinates.longitude} (updated: ${locationData.updated_at})`);

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
        placeId: place_id
      },
      travelMode: 'WALK',
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
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.legs.steps.navigationInstruction.instructions,routes.legs.distanceMeters,routes.legs.duration'
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
      place_name: 'Destination',
      destination_address: 'Address not available',
      travel_mode: 'walking',
      distance: {
        meters: route.distanceMeters || 0,
        text: route.distanceMeters ? `${(route.distanceMeters / 1609.34).toFixed(1)} miles` : 'Unknown distance'
      },
      duration: {
        seconds: route.duration ? parseInt(route.duration.replace('s', '')) : 0,
        text: route.duration ? `${Math.ceil(parseInt(route.duration.replace('s', '')) / 60)} minutes` : 'Unknown duration'
      },
      key_steps: steps,
      summary: `Walk ${route.distanceMeters ? `${(route.distanceMeters / 1609.34).toFixed(1)} miles` : ''} to reach your destination${route.duration ? ` (approximately ${Math.ceil(parseInt(route.duration.replace('s', '')) / 60)} minutes)` : ''}.`,
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