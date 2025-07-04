
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Waypoint {
  placeId?: string;
  coordinates?: [number, number]; // [lng, lat]
}

interface RouteRequest {
  origin: { coordinates: [number, number] };
  waypoints: Waypoint[];
  returnToOrigin?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin, waypoints, returnToOrigin = true }: RouteRequest = await req.json();
    
    console.log('🚀 Google Routes optimization request:', {
      origin,
      waypointCount: waypoints.length,
      returnToOrigin
    });

    if (!waypoints || waypoints.length === 0) {
      throw new Error('No waypoints provided for optimization');
    }

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      throw new Error('Google API key not configured');
    }

    // Prepare intermediate waypoints for Google Routes API
    const intermediateWaypoints = waypoints.map(waypoint => {
      if (waypoint.placeId) {
        return {
          via: false,
          placeId: waypoint.placeId
        };
      } else if (waypoint.coordinates) {
        return {
          via: false,
          location: {
            latLng: {
              latitude: waypoint.coordinates[1], // Convert lng,lat to lat,lng
              longitude: waypoint.coordinates[0]
            }
          }
        };
      }
      throw new Error('Waypoint must have either placeId or coordinates');
    });

    // Prepare Google Routes API request
    const routeRequest = {
      origin: {
        location: {
          latLng: {
            latitude: origin.coordinates[1],
            longitude: origin.coordinates[0]
          }
        }
      },
      destination: returnToOrigin ? {
        location: {
          latLng: {
            latitude: origin.coordinates[1],
            longitude: origin.coordinates[0]
          }
        }
      } : undefined,
      intermediates: intermediateWaypoints,
      travelMode: "WALK",
      routingPreference: "TRAFFIC_UNAWARE",
      optimizeWaypointOrder: true,
      polylineEncoding: "ENCODED_POLYLINE",
      computeAlternativeRoutes: false
    };

    console.log('📡 Calling Google Routes API with request:', JSON.stringify(routeRequest, null, 2));

    // Call Google Routes API
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex,routes.legs'
      },
      body: JSON.stringify(routeRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Google Routes API error:', response.status, errorText);
      throw new Error(`Google Routes API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Google Routes API response received:', {
      routesCount: data.routes?.length || 0,
      hasOptimizedOrder: !!data.routes?.[0]?.optimizedIntermediateWaypointIndex
    });

    if (!data.routes || data.routes.length === 0) {
      throw new Error('No routes found for the given waypoints');
    }

    const route = data.routes[0];
    
    // Extract key information
    const result = {
      success: true,
      route: {
        encodedPolyline: route.polyline?.encodedPolyline,
        optimizedWaypointOrder: route.optimizedIntermediateWaypointIndex || [],
        duration: route.duration,
        distanceMeters: route.distanceMeters,
        legs: route.legs || []
      },
      metadata: {
        originalWaypointCount: waypoints.length,
        optimized: route.optimizedIntermediateWaypointIndex?.length > 0,
        returnToOrigin
      }
    };

    console.log('🎯 Optimization result:', {
      distance: `${Math.round((result.route.distanceMeters || 0) / 1000 * 100) / 100}km`,
      duration: result.route.duration,
      optimizedOrder: result.route.optimizedWaypointOrder
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Google Routes optimization error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
