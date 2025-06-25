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
    const { placeId, landmarkName, coordinates } = await req.json()
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    
    if (!googleApiKey) {
      throw new Error('Google API key not configured')
    }

    let detailsUrl: string
    
    if (placeId) {
      // Use Place ID if provided
      detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,formatted_phone_number,formatted_address,opening_hours,website,photos,price_level,user_ratings_total&key=${googleApiKey}`
    } else if (landmarkName && coordinates) {
      // Find place by name and coordinates
      const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coordinates[1]},${coordinates[0]}&radius=100&keyword=${encodeURIComponent(landmarkName)}&key=${googleApiKey}`
      
      const searchResponse = await fetch(searchUrl)
      const searchData = await searchResponse.json()
      
      if (searchData.results && searchData.results.length > 0) {
        const nearestPlace = searchData.results[0]
        detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${nearestPlace.place_id}&fields=name,rating,formatted_phone_number,formatted_address,opening_hours,website,photos,price_level,user_ratings_total&key=${googleApiKey}`
      } else {
        return new Response(
          JSON.stringify({ error: 'No place found', fallback: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }
    } else {
      throw new Error('Either placeId or both landmarkName and coordinates are required')
    }

    const response = await fetch(detailsUrl)
    const data = await response.json()

    if (data.result) {
      // Process photos if available
      const photos = data.result.photos?.slice(0, 3).map((photo: any) => 
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photo.photo_reference}&key=${googleApiKey}`
      ) || []

      const enrichedData = {
        name: data.result.name,
        rating: data.result.rating,
        userRatingsTotal: data.result.user_ratings_total,
        phoneNumber: data.result.formatted_phone_number,
        address: data.result.formatted_address,
        website: data.result.website,
        priceLevel: data.result.price_level,
        openingHours: data.result.opening_hours?.weekday_text || [],
        isOpenNow: data.result.opening_hours?.open_now,
        photos,
        placeId: data.result.place_id
      }

      return new Response(
        JSON.stringify({ data: enrichedData, success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Place details not found', fallback: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
    )

  } catch (error) {
    console.error('Error fetching place details:', error)
    return new Response(
      JSON.stringify({ error: error.message, fallback: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
