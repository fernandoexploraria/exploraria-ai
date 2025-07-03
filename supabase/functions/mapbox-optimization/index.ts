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
    const { userLocation, landmarks, profile = 'walking', mapboxToken } = await req.json()
    
    console.log('🚀 Request received:', {
      userLocation,
      landmarkCount: landmarks?.length,
      profile,
      hasMapboxToken: !!mapboxToken,
      landmarks: landmarks?.map((l: any) => ({ name: l.name, coordinates: l.coordinates }))
    })
    
    if (!mapboxToken) {
      console.error('❌ Mapbox token not provided in request')
      throw new Error('Mapbox token is required but was not provided in the request payload.')
    }
    
    console.log('🔑 Using Mapbox token from request payload:', { 
      tokenLength: mapboxToken?.length 
    })

    if (!userLocation || !landmarks || landmarks.length === 0) {
      console.error('❌ Invalid input data:', { userLocation, landmarks })
      throw new Error('User location and landmarks are required')
    }

    if (!userLocation.longitude || !userLocation.latitude) {
      console.error('❌ Invalid user location coordinates:', userLocation)
      throw new Error('Valid user location coordinates are required')
    }

    // Validate landmark coordinates
    const invalidLandmarks = landmarks.filter((landmark: any) => 
      !landmark.coordinates || 
      !Array.isArray(landmark.coordinates) || 
      landmark.coordinates.length !== 2 ||
      typeof landmark.coordinates[0] !== 'number' ||
      typeof landmark.coordinates[1] !== 'number'
    )
    
    if (invalidLandmarks.length > 0) {
      console.error('❌ Invalid landmark coordinates:', invalidLandmarks)
      throw new Error(`${invalidLandmarks.length} landmarks have invalid coordinates`)
    }

    // Prepare waypoints: start with user location, then all landmarks
    const waypoints = [
      [userLocation.longitude, userLocation.latitude],
      ...landmarks.map((landmark: any) => landmark.coordinates)
    ]
    
    console.log('📍 Waypoints prepared:', waypoints)

    // Build coordinates string for Mapbox Optimization API
    const coordinatesString = waypoints.map(wp => `${wp[0]},${wp[1]}`).join(';')
    
    // Mapbox Optimization API URL
    // source=first: First waypoint (user location) is fixed as start
    // roundtrip=false: Don't return to start
    const optimizationUrl = `https://api.mapbox.com/optimized-trips/v1/${profile}/${coordinatesString}?source=first&roundtrip=false&geometries=geojson&steps=true&access_token=${mapboxToken}`
    
    console.log('🌐 Making Mapbox API request:', {
      url: optimizationUrl.replace(mapboxToken, '[TOKEN_HIDDEN]'),
      waypoints: waypoints.length
    })
    
    const response = await fetch(optimizationUrl)
    
    console.log('📡 Mapbox API response status:', response.status)
    
    const data = await response.json()
    
    console.log('📦 Mapbox API response data:', {
      code: data.code,
      hasTrips: !!data.trips,
      tripsLength: data.trips?.length,
      message: data.message,
      error: data.error
    })

    if (!response.ok) {
      console.error('❌ Mapbox API HTTP error:', response.status, data)
      throw new Error(`Mapbox API error (${response.status}): ${data.message || 'Unknown error'}`)
    }
    
    if (data.code !== 'Ok') {
      console.error('❌ Mapbox Optimization API error:', data)
      throw new Error(data.message || `API returned code: ${data.code}`)
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