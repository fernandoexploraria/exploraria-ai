import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    const { coordinates, profile = 'walking' } = await req.json()
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN')
    
    if (!mapboxToken) {
      throw new Error('Mapbox token not configured')
    }

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      throw new Error('At least 2 coordinates [longitude, latitude] are required for optimization')
    }

    // Validate coordinate format
    for (let i = 0; i < coordinates.length; i++) {
      if (!Array.isArray(coordinates[i]) || coordinates[i].length !== 2) {
        throw new Error(`Invalid coordinate format at index ${i}. Expected [longitude, latitude]`)
      }
    }

    // Build coordinates string for the API
    const coordinatesStr = coordinates.map((coord: [number, number]) => `${coord[0]},${coord[1]}`).join(';')
    
    // Build Mapbox Optimization API URL
    const optimizationUrl = `https://api.mapbox.com/optimized-trips/v1/mapbox/${profile}/${coordinatesStr}?access_token=${mapboxToken}&geometries=geojson&steps=true&roundtrip=true&source=first&destination=first`
    
    console.log('Fetching optimized route for coordinates:', coordinates.length)
    
    const response = await fetch(optimizationUrl)
    const data = await response.json()

    if (data.trips && data.trips.length > 0) {
      const trip = data.trips[0]
      const optimizedRoute = {
        geometry: trip.geometry,
        distance: trip.distance, // meters
        duration: trip.duration, // seconds
        waypointOrder: data.waypoints?.map((wp: any) => wp.waypoint_index) || [],
        steps: trip.legs?.flatMap((leg: any) => 
          leg.steps?.map((step: any) => ({
            instruction: step.maneuver.instruction,
            distance: step.distance,
            duration: step.duration,
            geometry: step.geometry
          })) || []
        ) || []
      }

      return new Response(
        JSON.stringify({ 
          route: optimizedRoute,
          waypoints: data.waypoints,
          success: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'No optimized route found', route: null, success: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
    )

  } catch (error) {
    console.error('Error fetching optimized route:', error)
    return new Response(
      JSON.stringify({ error: error.message, route: null, success: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})