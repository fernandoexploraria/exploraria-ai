
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
    const { coordinates } = await req.json()
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      throw new Error('At least 2 coordinates are required')
    }

    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN')
    if (!mapboxToken) {
      throw new Error('Mapbox token not configured')
    }

    // Format coordinates for Mapbox API (longitude,latitude pairs)
    const coordString = coordinates
      .map((coord: [number, number]) => `${coord[0]},${coord[1]}`)
      .join(';')

    const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/walking/${coordString}?access_token=${mapboxToken}&geometries=geojson&roundtrip=true&source=first&destination=first`

    console.log('Calling Mapbox Optimization API:', url)

    const response = await fetch(url)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Mapbox API error:', errorText)
      throw new Error(`Mapbox API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    
    if (!data.trips || !data.trips[0]) {
      throw new Error('No optimal route found')
    }

    const trip = data.trips[0]
    
    return new Response(
      JSON.stringify({
        route: {
          geometry: trip.geometry,
          distance: trip.distance,
          duration: trip.duration,
          waypoint_order: data.waypoints?.map((wp: any) => wp.waypoint_index) || []
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error in mapbox-optimization function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
