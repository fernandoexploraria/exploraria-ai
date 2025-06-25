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
    const { coordinates, radius = 500, type = 'restaurant|cafe|tourist_attraction' } = await req.json()
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    
    if (!googleApiKey) {
      throw new Error('Google API key not configured')
    }

    if (!coordinates || coordinates.length !== 2) {
      throw new Error('Valid coordinates [longitude, latitude] are required')
    }

    const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coordinates[1]},${coordinates[0]}&radius=${radius}&type=${type}&key=${googleApiKey}`
    
    console.log('Searching nearby places:', { coordinates, radius, type })
    
    const response = await fetch(searchUrl)
    const data = await response.json()

    if (data.results) {
      const nearbyPlaces = data.results.slice(0, 10).map((place: any) => ({
        placeId: place.place_id,
        name: place.name,
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total,
        priceLevel: place.price_level,
        types: place.types,
        vicinity: place.vicinity,
        openNow: place.opening_hours?.open_now,
        photoReference: place.photos?.[0]?.photo_reference,
        photoUrl: place.photos?.[0] 
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=200&photo_reference=${place.photos[0].photo_reference}&key=${googleApiKey}`
          : null,
        geometry: {
          location: {
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng
          }
        }
      }))

      return new Response(
        JSON.stringify({ 
          places: nearbyPlaces, 
          total: data.results.length,
          nextPageToken: data.next_page_token,
          success: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ places: [], total: 0, success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error fetching nearby places:', error)
    return new Response(
      JSON.stringify({ error: error.message, places: [], total: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
