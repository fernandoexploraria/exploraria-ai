
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

    // Use new Places API v1 searchText endpoint
    const searchUrl = 'https://places.googleapis.com/v1/places:searchText'
    
    // Build request body for new API
    const requestBody: any = {
      textQuery: query,
      maxResultCount: 20
    }

    // Add location bias if coordinates are provided
    if (coordinates && coordinates.length === 2) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: coordinates[1],  // latitude
            longitude: coordinates[0]  // longitude
          },
          radius: radius
        }
      }
    }
    
    console.log('Searching places:', { query, coordinates, radius })
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.types,places.regularOpeningHours,places.photos,places.location'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      console.error('Places API search error:', await response.text())
      throw new Error(`Places API request failed: ${response.status}`)
    }

    const data = await response.json()

    if (data.places) {
      // Map new API response to legacy format for backward compatibility
      const searchResults = data.places.slice(0, 20).map((place: any) => ({
        placeId: place.id,
        name: place.displayName?.text || place.displayName,
        formattedAddress: place.formattedAddress,
        rating: place.rating,
        userRatingsTotal: place.userRatingCount,
        priceLevel: place.priceLevel,
        types: place.types,
        openNow: place.regularOpeningHours?.openNow,
        photoReference: place.photos?.[0]?.name,
        photoUrl: place.photos?.[0] 
          ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxWidthPx=200&key=${googleApiKey}`
          : null,
        geometry: {
          location: {
            lat: place.location?.latitude || 0,
            lng: place.location?.longitude || 0
          }
        }
      }))

      return new Response(
        JSON.stringify({ 
          results: searchResults, 
          total: data.places.length,
          nextPageToken: data.nextPageToken, // New API pagination format
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
