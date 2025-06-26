
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

    // Convert legacy pipe-separated types to array format for new API
    const typeArray = type.split('|').map((t: string) => t.trim())
    
    // Map some common legacy types to new API types if needed
    const mappedTypes = typeArray.map((t: string) => {
      switch (t) {
        case 'tourist_attraction':
          return 'tourist_attraction'
        case 'restaurant':
          return 'restaurant'
        case 'cafe':
          return 'cafe'
        case 'point_of_interest':
          return 'point_of_interest'
        default:
          return t
      }
    })

    // Use new Places API v1 searchNearby endpoint
    const searchUrl = 'https://places.googleapis.com/v1/places:searchNearby'
    
    console.log('Searching nearby places:', { coordinates, radius, types: mappedTypes })
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.types,places.formattedAddress,places.regularOpeningHours,places.photos,places.location'
      },
      body: JSON.stringify({
        includedTypes: mappedTypes,
        maxResultCount: 10,
        locationRestriction: {
          circle: {
            center: {
              latitude: coordinates[1],  // latitude
              longitude: coordinates[0]  // longitude
            },
            radius: radius
          }
        }
      })
    })

    if (!response.ok) {
      console.error('Places API search error:', await response.text())
      throw new Error(`Places API request failed: ${response.status}`)
    }

    const data = await response.json()

    if (data.places) {
      // Map new API response to legacy format for backward compatibility
      const nearbyPlaces = data.places.slice(0, 10).map((place: any) => ({
        placeId: place.id,
        name: place.displayName?.text || place.displayName,
        rating: place.rating,
        userRatingsTotal: place.userRatingCount,
        priceLevel: place.priceLevel,
        types: place.types,
        vicinity: place.formattedAddress,
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
          places: nearbyPlaces, 
          total: data.places.length,
          nextPageToken: data.nextPageToken, // New API may have different pagination
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
