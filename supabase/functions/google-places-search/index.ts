
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
    const { query, coordinates, radius = 1000 } = await req.json()
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    
    if (!googleApiKey) {
      throw new Error('Google API key not configured')
    }

    if (!query) {
      throw new Error('Search query is required')
    }

    let searchUrl: string
    
    if (coordinates && coordinates.length === 2) {
      // Location-based search
      searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${coordinates[1]},${coordinates[0]}&radius=${radius}&key=${googleApiKey}`
    } else {
      // General text search
      searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${googleApiKey}`
    }
    
    console.log('Searching places:', { query, coordinates, radius })
    
    const response = await fetch(searchUrl)
    const data = await response.json()

    if (data.results) {
      const searchResults = data.results.slice(0, 20).map((place: any) => ({
        placeId: place.place_id,
        name: place.name,
        formattedAddress: place.formatted_address,
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total,
        priceLevel: place.price_level,
        types: place.types,
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
          results: searchResults, 
          total: data.results.length,
          nextPageToken: data.next_page_token,
          success: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ results: [], total: 0, success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error searching places:', error)
    return new Response(
      JSON.stringify({ error: error.message, results: [], total: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
