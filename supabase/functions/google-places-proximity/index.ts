import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Price level mapping utility
const mapPriceLevel = (priceLevel: string | number | null | undefined): number | null => {
  if (priceLevel === null || priceLevel === undefined) {
    return null;
  }

  if (typeof priceLevel === 'number') {
    if (priceLevel >= 0 && priceLevel <= 4) {
      return priceLevel;
    }
    console.warn('Unknown numeric price level:', priceLevel, 'using fallback 9999');
    return 9999;
  }

  const priceLevelMap: Record<string, number> = {
    'PRICE_LEVEL_FREE': 0,
    'PRICE_LEVEL_INEXPENSIVE': 1,
    'PRICE_LEVEL_MODERATE': 2,
    'PRICE_LEVEL_EXPENSIVE': 3,
    'PRICE_LEVEL_VERY_EXPENSIVE': 4
  };

  const mappedValue = priceLevelMap[priceLevel];
  
  if (mappedValue !== undefined) {
    return mappedValue;
  }

  console.warn('Unknown price level enum:', priceLevel, 'using fallback 9999');
  return 9999;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { coordinates, radius = 300, types } = await req.json()

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      console.error('❌ Invalid coordinates format:', coordinates)
      return new Response(
        JSON.stringify({ error: 'Coordinates must be an array of [longitude, latitude]' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const [lng, lat] = coordinates
    console.log(`🔍 Searching proximity services near [${lng}, ${lat}] within ${radius}m`)

    // Use the service types provided, or default to tourist services
    const serviceTypes = types || ['restaurant', 'cafe', 'shopping_mall', 'subway_station', 'public_bathroom']
    console.log('🏪 Using service types:', serviceTypes)

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    if (!googleApiKey) {
      console.error('❌ Google API key not found')
      return new Response(
        JSON.stringify({ error: 'Google API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare request body for Google Places API (New)
    const requestBody = {
      includedTypes: serviceTypes,
      maxResultCount: 8, // Smaller number for focused service results
      locationRestriction: {
        circle: {
          center: {
            latitude: lat,
            longitude: lng
          },
          radius: radius
        }
      },
      languageCode: "en"
    }

    console.log('📍 Google Places API request:', JSON.stringify(requestBody, null, 2))

    // Call Google Places API (New)
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.location,places.photos,places.currentOpeningHours,places.priceLevel'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Google Places API error:', response.status, errorText)
      return new Response(
        JSON.stringify({ error: `Google Places API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    console.log('✅ Google Places API response:', JSON.stringify(data, null, 2))

    // Transform the response to match the expected format with price level mapping
    const transformedResults = (data.places || []).map((place: any) => ({
      place_id: place.id,
      name: place.displayName?.text || 'Unknown',
      vicinity: place.formattedAddress || '',
      rating: place.rating,
      user_ratings_total: place.userRatingCount,
      types: place.types || [],
      geometry: {
        location: {
          lat: place.location?.latitude || 0,
          lng: place.location?.longitude || 0
        }
      },
      photos: place.photos?.map((photo: any) => ({
        photo_reference: photo.name?.split('/').pop() || '',
        height: photo.heightPx || 400,
        width: photo.widthPx || 400
      })) || [],
      opening_hours: place.currentOpeningHours ? {
        open_now: place.currentOpeningHours.openNow || false
      } : undefined,
      price_level: mapPriceLevel(place.priceLevel) // Apply price level mapping
    }))

    console.log(`🎯 Found ${transformedResults.length} proximity services with price level mapping`)

    return new Response(
      JSON.stringify({ 
        results: transformedResults,
        status: 'OK'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('❌ Error in google-places-proximity:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
