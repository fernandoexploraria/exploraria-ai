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
    const { userLocation, landmarks, profile = 'walking' } = await req.json()
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN')
    
    if (!mapboxToken) {
      throw new Error('Mapbox token not configured')
    }

    if (!userLocation || !landmarks || landmarks.length === 0) {
      throw new Error('User location and landmarks are required')
    }

    if (!userLocation.longitude || !userLocation.latitude) {
      throw new Error('Valid user location coordinates are required')
    }

    // Prepare waypoints: start with user location, then all landmarks
    const waypoints = [
      [userLocation.longitude, userLocation.latitude],
      ...landmarks.map((landmark: any) => landmark.coordinates)
    ]

    // Build coordinates string for Mapbox Optimization API
    const coordinatesString = waypoints.map(wp => `${wp[0]},${wp[1]}`).join(';')
    
    // Mapbox Optimization API URL
    // source=first: First waypoint (user location) is fixed as start
    // roundtrip=false: Don't return to start
    const optimizationUrl = `https://api.mapbox.com/optimized-trips/v1/${profile}/${coordinatesString}?source=first&roundtrip=false&geometries=geojson&steps=true&access_token=${mapboxToken}`
    
    console.log('Fetching optimal route for:', { 
      userLocation, 
      landmarkCount: landmarks.length, 
      profile 
    })
    
    const response = await fetch(optimizationUrl)
    const data = await response.json()

    if (!response.ok || data.code !== 'Ok') {
      console.error('Mapbox Optimization API error:', data)
      throw new Error(data.message || 'Failed to calculate optimal route')
    }

    if (!data.trips || data.trips.length === 0) {
      throw new Error('No optimal route found')
    }

    const trip = data.trips[0]
    
    // Process the response to include optimized waypoint order
    const optimizedWaypoints = trip.waypoints.slice(1) // Remove user location (first waypoint)
    const optimizedLandmarks = optimizedWaypoints.map((waypoint: any) => {
      const waypointIndex = waypoint.waypoint_index - 1 // Adjust for user location being first
      return landmarks[waypointIndex]
    })

    const result = {
      route: {
        geometry: trip.geometry,
        distance: trip.distance, // meters
        duration: trip.duration, // seconds
        legs: trip.legs.map((leg: any) => ({
          distance: leg.distance,
          duration: leg.duration,
          steps: leg.steps?.map((step: any) => ({
            instruction: step.maneuver.instruction,
            distance: step.distance,
            duration: step.duration
          })) || []
        }))
      },
      optimizedLandmarks,
      summary: {
        totalDistance: Math.round(trip.distance),
        totalDuration: Math.round(trip.duration / 60), // Convert to minutes
        waypointCount: landmarks.length,
        profile
      },
      success: true
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error calculating optimal route:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to calculate optimal route',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})