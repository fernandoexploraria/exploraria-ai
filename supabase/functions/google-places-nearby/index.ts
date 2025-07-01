
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// 28 specific landmark types for intelligent tour generation
const LANDMARK_TYPES = [
  'tourist_attraction',
  'museum',
  'park',
  'amusement_park',
  'aquarium',
  'art_gallery',
  'zoo',
  'church',
  'hindu_temple',
  'mosque',
  'synagogue',
  'cemetery',
  'city_hall',
  'courthouse',
  'embassy',
  'fire_station',
  'police',
  'post_office',
  'school',
  'university',
  'library',
  'hospital',
  'pharmacy',
  'bank',
  'atm',
  'gas_station',
  'parking',
  'subway_station'
];

// Dynamic radius logic based on destination type - Updated with your specifications
const getRadiusForDestinationType = (types: string[] = []) => {
  if (types.includes('locality') || types.includes('administrative_area_level_1')) {
    return 5000; // 5km for localities
  }
  if (types.includes('sublocality') || types.includes('neighborhood')) {
    return 2000; // 2km for sublocalities
  }
  if (types.includes('tourist_attraction')) {
    return 1000; // 1km for tourist attractions
  }
  if (types.includes('park')) {
    return 500; // 0.5km for parks
  }
  if (types.includes('museum')) {
    return 250; // 0.25km for museums
  }
  return 10000; // 10km default
};

// Dynamic result count logic based on destination type
const getMaxResultsForDestinationType = (types: string[] = []) => {
  if (types.includes('locality') || types.includes('administrative_area_level_1')) {
    return 20; // 20 results for localities
  }
  if (types.includes('sublocality') || types.includes('neighborhood')) {
    return 15; // 15 results for sublocalities
  }
  if (types.includes('tourist_attraction')) {
    return 10; // 10 results for tourist attractions
  }
  if (types.includes('park')) {
    return 5; // 5 results for parks
  }
  if (types.includes('museum')) {
    return 5; // 5 results for museums
  }
  return 20; // 20 default
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    const { coordinates, radius, type, destinationTypes } = await req.json()
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    
    if (!googleApiKey) {
      throw new Error('Google API key not configured')
    }

    if (!coordinates || coordinates.length !== 2) {
      throw new Error('Valid coordinates [longitude, latitude] are required')
    }

    // Use dynamic radius and max results based on destination type if provided
    const searchRadius = radius || getRadiusForDestinationType(destinationTypes)
    const maxResults = getMaxResultsForDestinationType(destinationTypes)
    
    console.log('Searching nearby landmarks with enhanced data capture:', { 
      coordinates, 
      radius: searchRadius, 
      maxResults,
      destinationTypes,
      landmarkTypes: LANDMARK_TYPES.length 
    })
    
    // Use new Places API v1 searchNearby endpoint
    const searchUrl = 'https://places.googleapis.com/v1/places:searchNearby'
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.types,places.formattedAddress,places.regularOpeningHours,places.photos,places.location,places.editorialSummary,places.websiteUri'
      },
      body: JSON.stringify({
        includedTypes: LANDMARK_TYPES,
        maxResultCount: maxResults,
        locationRestriction: {
          circle: {
            center: {
              latitude: coordinates[1],  // latitude
              longitude: coordinates[0]  // longitude
            },
            radius: searchRadius
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
      // Enhanced mapping with complete data preservation
      const nearbyPlaces = data.places.slice(0, maxResults).map((place: any) => ({
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
          ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxWidthPx=400&key=${googleApiKey}`
          : null,
        geometry: {
          location: {
            lat: place.location?.latitude || 0,
            lng: place.location?.longitude || 0
          }
        },
        // Enhanced fields for complete data capture
        editorialSummary: place.editorialSummary?.text,
        website: place.websiteUri,
        regularOpeningHours: place.regularOpeningHours,
        photos: place.photos || [],
        searchRadius: searchRadius,
        maxResults: maxResults,
        // 🔥 NEW: Store complete raw Google Places API response
        rawGooglePlacesData: place
      }))

      console.log(`Enhanced data capture: Found ${nearbyPlaces.length} landmarks within ${searchRadius}m (max ${maxResults} results)`)

      return new Response(
        JSON.stringify({ 
          places: nearbyPlaces, 
          total: data.places.length,
          searchRadius: searchRadius,
          maxResults: maxResults,
          success: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        places: [], 
        total: 0, 
        searchRadius: searchRadius, 
        maxResults: maxResults,
        success: true 
      }),
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
