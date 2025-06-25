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
    const { origin, destination, profile = 'walking', alternatives = true } = await req.json()
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN')
    
    if (!mapboxToken) {
      throw new Error('Mapbox token not configured')
    }

    if (!origin || !destination || origin.length !== 2 || destination.length !== 2) {
      throw new Error('Valid origin and destination coordinates [longitude, latitude] are required')
    }

    // Build Mapbox Directions API URL
    const originStr = `${origin[0]},${origin[1]}`
    const destinationStr = `${destination[0]},${destination[1]}`
    
    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${originStr};${destinationStr}?alternatives=${alternatives}&geometries=geojson&steps=true&access_token=${mapboxToken}`
    
    console.log('Fetching directions:', { origin, destination, profile })
    
    const response = await fetch(directionsUrl)
    const data = await response.json()

    if (data.routes && data.routes.length > 0) {
      const processedRoutes = data.routes.map((route: any) => ({
        geometry: route.geometry,
        distance: route.distance, // meters
        duration: route.duration, // seconds
        steps: route.legs[0]?.steps?.map((step: any) => ({
          instruction: step.maneuver.instruction,
          distance: step.distance,
          duration: step.duration,
          geometry: step.geometry
        })) || []
      }))

      return new Response(
        JSON.stringify({ 
          routes: processedRoutes,
          origin: data.waypoints[0],
          destination: data.waypoints[1],
          success: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'No routes found', routes: [], success: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
    )

  } catch (error) {
    console.error('Error fetching directions:', error)
    return new Response(
      JSON.stringify({ error: error.message, routes: [], success: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
