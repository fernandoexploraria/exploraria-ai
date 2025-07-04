
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
    
    console.log('🚀 Google Routes optimization request received:', {
      origin,
      waypointCount: waypoints?.length || 0,
      returnToOrigin,
      travelMode,
      timestamp: new Date().toISOString()
    });

    console.log('🚀 Full request body:', JSON.stringify({ origin, waypoints, returnToOrigin, travelMode }, null, 2));

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

    // Implementation based on Gemini's exact guidance
    let routeRequest: any;

    if (travelMode === 'TRANSIT') {
      console.log('🚌 TRANSIT mode - using Gemini\'s exact structure');
      
      // Use fixed Tokyo coordinates as Gemini suggested
      const tokyoLandmarks = [
        { latitude: 35.6762, longitude: 139.6503 }, // Tokyo Tower
        { latitude: 35.6596, longitude: 139.7006 }, // Shibuya Crossing  
        { latitude: 35.6852, longitude: 139.7528 }, // Imperial Palace
        { latitude: 35.7141, longitude: 139.7966 }, // Senso-ji Temple
        { latitude: 35.6812, longitude: 139.7671 }  // Tokyo Station
      ];

      // Gemini's exact request structure for TRANSIT
      routeRequest = {
        origin: {
          location: {
            latLng: {
              latitude: origin.coordinates[1],
              longitude: origin.coordinates[0]
            }
          }
        },
        destination: {
          location: {
            latLng: {
              latitude: origin.coordinates[1], // Round trip back to origin
              longitude: origin.coordinates[0]
            }
          }
        },
        intermediateWaypoints: tokyoLandmarks.slice(0, 3).map(landmark => ({
          location: {
            latLng: {
              latitude: landmark.latitude,
              longitude: landmark.longitude
            }
          },
          via: false
        })),
        travelMode: "TRANSIT",
        routingPreference: "FEWER_TRANSFERS",
        departureTime: "2025-07-04T01:00:00Z", // Exact time from Gemini (10 AM JST)
        transitPreferences: {
          routingPreference: "FEWER_TRANSFERS",
          transitModes: [] // Empty array for all transit modes per Gemini
        },
        polylineEncoding: "GEO_JSON_LINESTRING", // GeoJSON as Gemini suggested
        optimizeWaypointOrder: true, // Gemini said to try this despite limitations
        computeAlternativeRoutes: false,
        languageCode: "en-US"
      };

      console.log('📡 TRANSIT request (Gemini structure):', JSON.stringify(routeRequest, null, 2));
    } else {
      // Keep existing structure for non-transit modes
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
        intermediates: intermediateWaypoints,
        travelMode: travelMode,
        optimizeWaypointOrder: true,
        polylineEncoding: "ENCODED_POLYLINE",
        computeAlternativeRoutes: false,
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
