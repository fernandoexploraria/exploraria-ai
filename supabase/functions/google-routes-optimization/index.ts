
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
  travelMode?: 'WALK' | 'BICYCLE' | 'DRIVE' | 'TRANSIT';
}

// Validation function for waypoints
function validateWaypoints(waypoints: Waypoint[]): { isValid: boolean; error?: string } {
  if (!waypoints || waypoints.length === 0) {
    return { isValid: false, error: 'No waypoints provided' };
  }
  
  if (waypoints.length > 25) {
    return { isValid: false, error: 'Maximum 25 waypoints allowed for Routes API' };
  }
  
  for (let i = 0; i < waypoints.length; i++) {
    const waypoint = waypoints[i];
    if (!waypoint.placeId && !waypoint.coordinates) {
      return { isValid: false, error: `Waypoint ${i} must have either placeId or coordinates` };
    }
    
    if (waypoint.coordinates) {
      const [lng, lat] = waypoint.coordinates;
      if (isNaN(lng) || isNaN(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) {
        return { isValid: false, error: `Invalid coordinates for waypoint ${i}: [${lng}, ${lat}]` };
      }
    }
  }
  
  return { isValid: true };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin, waypoints, returnToOrigin = true, travelMode = 'WALK' }: RouteRequest = await req.json();
    
    console.log('🚀 Google Routes optimization request:', {
      origin,
      waypointCount: waypoints.length,
      returnToOrigin,
      travelMode
    });

    // Validate waypoints
    const validation = validateWaypoints(waypoints);
    if (!validation.isValid) {
      console.error('❌ Waypoint validation failed:', validation.error);
      throw new Error(validation.error!);
    }

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      console.error('❌ Google API key not configured');
      throw new Error('Google API key not configured');
    }

    // Prepare intermediate waypoints for Google Routes API
    const intermediateWaypoints = waypoints.map((waypoint, index) => {
      if (waypoint.placeId) {
        console.log(`📍 Waypoint ${index}: Using placeId ${waypoint.placeId}`);
        return {
          placeId: waypoint.placeId,
          via: false
        };
      } else if (waypoint.coordinates) {
        console.log(`📍 Waypoint ${index}: Using coordinates [${waypoint.coordinates[0]}, ${waypoint.coordinates[1]}]`);
        return {
          location: {
            latLng: {
              latitude: waypoint.coordinates[1], // Convert lng,lat to lat,lng
              longitude: waypoint.coordinates[0]
            }
          },
          via: false
        };
      }
      throw new Error(`Waypoint ${index} must have either placeId or coordinates`);
    });

    // Prepare Google Routes API request based on Gemini's guidance
    let routeRequest: any;

    // Handle TRANSIT mode with specific structure per Gemini
    if (travelMode === 'TRANSIT') {
      // Create proper departure time (today at 10:00 AM JST = 01:00 AM UTC)
      const today = new Date();
      const departureTime = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 1, 0, 0));
      
      console.log('🚌 TRANSIT mode - departure time (10 AM JST):', departureTime.toISOString());
      
      routeRequest = {
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
        intermediateWaypoints: intermediateWaypoints, // Correct property for TRANSIT
        travelMode: "TRANSIT",
        routingPreference: "FEWER_TRANSFERS",
        departureTime: departureTime.toISOString(),
        transitPreferences: {
          routingPreference: "FEWER_TRANSFERS",
          transitModes: [] // Empty for all transit types
        },
        optimizeWaypointOrder: true,
        polylineEncoding: "GEO_JSON_LINESTRING",
        computeAlternativeRoutes: false,
        languageCode: "en-US"
      };
    } else {
      // For non-transit modes (WALK, BICYCLE, DRIVE)
      routeRequest = {
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
        intermediates: intermediateWaypoints, // Use intermediates for non-transit
        travelMode: travelMode,
        optimizeWaypointOrder: true,
        polylineEncoding: "ENCODED_POLYLINE",
        computeAlternativeRoutes: false,
        // Add routingPreference for DRIVE mode only
        ...(travelMode === 'DRIVE' && {
          routingPreference: "TRAFFIC_AWARE"
        })
      };
    }

    console.log('📡 Calling Google Routes API with request:', JSON.stringify(routeRequest, null, 2));

    // Enhanced X-Goog-FieldMask for more detailed response
    const fieldMask = travelMode === 'TRANSIT' ? [
      'routes.duration',
      'routes.distanceMeters',
      'routes.polyline', // For GeoJSON format
      'routes.optimizedIntermediateWaypointIndex',
      'routes.legs.duration',
      'routes.legs.distanceMeters',
      'routes.legs.steps' // Transit steps for detailed instructions
    ].join(',') : [
      'routes.duration',
      'routes.distanceMeters', 
      'routes.polyline.encodedPolyline',
      'routes.optimizedIntermediateWaypointIndex',
      'routes.legs.duration',
      'routes.legs.distanceMeters'
    ].join(',');

    console.log('🎯 Using field mask:', fieldMask);

    // Call Google Routes API
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': fieldMask
      },
      body: JSON.stringify(routeRequest)
    });

    console.log('📡 Google Routes API response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Google Routes API error details:', {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
        requestBody: JSON.stringify(routeRequest, null, 2),
        fieldMask
      });
      
      // Try to parse error response for more details
      try {
        const errorJson = JSON.parse(errorText);
        console.error('❌ Parsed error response:', JSON.stringify(errorJson, null, 2));
      } catch (parseError) {
        console.error('❌ Could not parse error response as JSON');
      }
      
      throw new Error(`Google Routes API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Google Routes API response received:', {
      routesCount: data.routes?.length || 0,
      hasOptimizedOrder: !!data.routes?.[0]?.optimizedIntermediateWaypointIndex,
      responseKeys: Object.keys(data)
    });

    if (!data.routes || data.routes.length === 0) {
      console.error('❌ No routes found in API response:', JSON.stringify(data, null, 2));
      throw new Error('No routes found for the given waypoints');
    }

    const route = data.routes[0];
    console.log('📍 Route details:', {
      hasPolylineEncoded: !!route.polyline?.encodedPolyline,
      hasPolylineGeoJson: !!route.polyline?.geoJsonLinestring,
      optimizedOrder: route.optimizedIntermediateWaypointIndex,
      duration: route.duration,
      distance: route.distanceMeters,
      legsCount: route.legs?.length || 0
    });
    
    // Extract key information - handle both encoded and GeoJSON formats
    const result = {
      success: true,
      route: {
        encodedPolyline: route.polyline?.encodedPolyline || null,
        geoJsonPolyline: route.polyline?.geoJsonLinestring || null,
        optimizedWaypointOrder: route.optimizedIntermediateWaypointIndex || [],
        duration: route.duration,
        distanceMeters: route.distanceMeters,
        legs: route.legs || []
      },
      metadata: {
        originalWaypointCount: waypoints.length,
        optimized: route.optimizedIntermediateWaypointIndex?.length > 0,
        returnToOrigin,
        apiRequestSent: {
          waypointCount: intermediateWaypoints.length,
          travelMode: travelMode,
          optimizeWaypointOrder: travelMode === 'TRANSIT' ? true : true // Both try optimization, but TRANSIT may not work well
        }
      }
    };

    console.log('🎯 Optimization result:', {
      distance: `${Math.round((result.route.distanceMeters || 0) / 1000 * 100) / 100}km`,
      duration: result.route.duration,
      optimizedOrder: result.route.optimizedWaypointOrder,
      success: true
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Google Routes optimization error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error occurred',
      debug: {
        errorType: error.name,
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
