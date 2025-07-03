
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  console.log('🚀 Mapbox Optimization function started')
  
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling CORS preflight request')
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    console.log('📥 Processing POST request')
    
    // Parse request body with error handling
    let requestBody;
    try {
      requestBody = await req.json()
      console.log('📋 Request body parsed:', JSON.stringify(requestBody))
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError)
      throw new Error('Invalid JSON in request body')
    }

    const { coordinates } = requestBody
    console.log('🎯 Extracted coordinates:', JSON.stringify(coordinates))
    
    // Enhanced coordinate validation
    if (!coordinates) {
      console.error('❌ No coordinates provided')
      throw new Error('Coordinates are required')
    }
    
    if (!Array.isArray(coordinates)) {
      console.error('❌ Coordinates is not an array:', typeof coordinates)
      throw new Error('Coordinates must be an array')
    }
    
    if (coordinates.length < 2) {
      console.error('❌ Insufficient coordinates:', coordinates.length)
      throw new Error('At least 2 coordinates are required')
    }

    // Validate each coordinate
    for (let i = 0; i < coordinates.length; i++) {
      const coord = coordinates[i];
      console.log(`🔍 Validating coordinate ${i}:`, JSON.stringify(coord))
      
      if (!Array.isArray(coord) || coord.length !== 2) {
        console.error(`❌ Invalid coordinate format at index ${i}:`, coord)
        throw new Error(`Coordinate ${i} must be [longitude, latitude] array`)
      }
      
      const [lng, lat] = coord;
      if (typeof lng !== 'number' || typeof lat !== 'number') {
        console.error(`❌ Non-numeric coordinate at index ${i}:`, { lng, lat })
        throw new Error(`Coordinate ${i} must contain numeric values`)
      }
      
      if (isNaN(lng) || isNaN(lat)) {
        console.error(`❌ NaN coordinate at index ${i}:`, { lng, lat })
        throw new Error(`Coordinate ${i} contains NaN values`)
      }
      
      if (Math.abs(lng) > 180 || Math.abs(lat) > 90) {
        console.error(`❌ Invalid coordinate range at index ${i}:`, { lng, lat })
        throw new Error(`Coordinate ${i} is out of valid range`)
      }
    }

    console.log('✅ All coordinates validated successfully')

    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN')
    if (!mapboxToken) {
      console.error('❌ Mapbox token not found in environment')
      throw new Error('Mapbox token not configured')
    }
    console.log('✅ Mapbox token found')

    // Format coordinates for Mapbox API (longitude,latitude pairs)
    const coordString = coordinates
      .map((coord: [number, number]) => `${coord[0]},${coord[1]}`)
      .join(';')
    
    console.log('🗺️ Formatted coordinate string:', coordString)

    // Correct Mapbox Optimization API URL
    const url = `https://api.mapbox.com/optimized-trips/v1/walking/${coordString}?access_token=${mapboxToken}&geometries=geojson&roundtrip=true&source=first`
    console.log('🌐 API URL:', url)

    console.log('📡 Calling Mapbox Optimization API...')
    const startTime = Date.now()

    const response = await fetch(url)
    const endTime = Date.now()
    
    console.log(`⏱️ API call completed in ${endTime - startTime}ms`)
    console.log('📊 Response status:', response.status, response.statusText)
    console.log('📋 Response headers:', JSON.stringify([...response.headers.entries()]))
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Mapbox API error response:', errorText)
      console.error('❌ Response status:', response.status)
      throw new Error(`Mapbox API error: ${response.status} - ${errorText}`)
    }

    console.log('📥 Parsing API response...')
    const data = await response.json()
    console.log('📋 API response structure:', JSON.stringify(data, null, 2))
    
    if (!data.trips || !data.trips[0]) {
      console.error('❌ No trips in API response:', data)
      throw new Error('No optimal route found in API response')
    }

    const trip = data.trips[0]
    console.log('🛣️ Trip data:', JSON.stringify(trip, null, 2))
    
    const result = {
      route: {
        geometry: trip.geometry,
        distance: trip.distance,
        duration: trip.duration,
        waypoint_order: data.waypoints?.map((wp: any) => wp.waypoint_index) || []
      }
    }
    
    console.log('✅ Returning successful result:', JSON.stringify(result))
    
    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('💥 Error in mapbox-optimization function:', error)
    console.error('💥 Error name:', error.name)
    console.error('💥 Error message:', error.message)
    console.error('💥 Error stack:', error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
