
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

    let placeDetails: any = null
    
    if (placeId) {
      // Use new Places API v1 for place details with expanded field mask
      const detailsUrl = `https://places.googleapis.com/v1/places/${placeId}`
      
      const detailsResponse = await fetch(detailsUrl, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': googleApiKey,
          'X-Goog-FieldMask': 'displayName,rating,nationalPhoneNumber,formattedAddress,regularOpeningHours,websiteUri,photos,priceLevel,userRatingCount,viewport,editorialSummary,reviews,addressComponents,types,location'
        }
      })
      
      if (detailsResponse.ok) {
        placeDetails = await detailsResponse.json()
      } else {
        console.error('Places API details error:', await detailsResponse.text())
      }
    } else if (landmarkName && coordinates) {
      // Use new Places API v1 for nearby search with expanded field mask
      const searchUrl = 'https://places.googleapis.com/v1/places:searchNearby'
      
      const searchResponse = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleApiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.nationalPhoneNumber,places.formattedAddress,places.regularOpeningHours,places.websiteUri,places.photos,places.priceLevel,places.userRatingCount,places.viewport,places.editorialSummary,places.reviews,places.addressComponents,places.types,places.location'
        },
        body: JSON.stringify({
          includedTypes: ['tourist_attraction', 'point_of_interest'],
          maxResultCount: 5,
          locationRestriction: {
            circle: {
              center: {
                latitude: coordinates[1],
                longitude: coordinates[0]
              },
              radius: 100
            }
          }
        })
      })

      if (searchResponse.ok) {
        const searchData = await searchResponse.json()
        
        if (searchData.places && searchData.places.length > 0) {
          // Find the best match by name similarity
          const bestMatch = searchData.places.find((place: any) => 
            place.displayName?.text?.toLowerCase().includes(landmarkName.toLowerCase()) ||
            landmarkName.toLowerCase().includes(place.displayName?.text?.toLowerCase())
          ) || searchData.places[0]
          
          placeDetails = bestMatch
        }
      } else {
        console.error('Places API search error:', await searchResponse.text())
      }
    } else {
      throw new Error('Either placeId or both landmarkName and coordinates are required')
    }

    if (placeDetails) {
      // Process photos if available - new API format
      const photos = placeDetails.photos?.slice(0, 5).map((photo: any) => 
        `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=800&key=${googleApiKey}`
      ) || []

      // Map new API response to expected format with enhanced data
      const enrichedData = {
        name: placeDetails.displayName?.text || placeDetails.displayName,
        rating: placeDetails.rating,
        userRatingsTotal: placeDetails.userRatingCount,
        phoneNumber: placeDetails.nationalPhoneNumber,
        address: placeDetails.formattedAddress,
        website: placeDetails.websiteUri,
        priceLevel: placeDetails.priceLevel,
        openingHours: placeDetails.regularOpeningHours?.weekdayDescriptions || [],
        isOpenNow: placeDetails.regularOpeningHours?.openNow,
        photos,
        placeId: placeDetails.id || placeId,
        // Enhanced fields
        viewport: placeDetails.viewport,
        editorialSummary: placeDetails.editorialSummary?.text,
        reviews: placeDetails.reviews?.slice(0, 3).map((review: any) => ({
          author: review.authorAttribution?.displayName,
          rating: review.rating,
          text: review.text?.text,
          time: review.publishTime
        })) || [],
        addressComponents: placeDetails.addressComponents || [],
        types: placeDetails.types || [],
        location: placeDetails.location
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
