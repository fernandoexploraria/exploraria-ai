import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

// Contextual POI types based on user location and activity
const CONTEXTUAL_POI_TYPES = [
  'tourist_attraction',
  'museum',
  'park',
  'restaurant',
  'cafe',
  'art_gallery',
  'shopping_mall',
  'store',
  'church',
  'mosque',
  'synagogue',
  'hindu_temple',
  'library',
  'university',
  'hospital',
  'pharmacy',
  'bank',
  'atm',
  'gas_station',
  'subway_station',
  'bus_station',
  'train_station'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    const { userLocation, radius = 150, maxResults = 3 } = await req.json()
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    
    if (!googleApiKey) {
      throw new Error('Google API key not configured')
    }

    if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
      throw new Error('Valid user location with latitude and longitude is required')
    }
    
    console.log('🔍 Contextual POI search:', { 
      location: `${userLocation.latitude.toFixed(6)}, ${userLocation.longitude.toFixed(6)}`,
      radius,
      maxResults,
      types: CONTEXTUAL_POI_TYPES.length 
    })
    
    // Use Google Places API v1 searchNearby endpoint
    const searchUrl = 'https://places.googleapis.com/v1/places:searchNearby'
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.types,places.formattedAddress,places.regularOpeningHours,places.photos,places.location,places.editorialSummary,places.websiteUri'
      },
      body: JSON.stringify({
        includedTypes: CONTEXTUAL_POI_TYPES,
        maxResultCount: maxResults,
        locationRestriction: {
          circle: {
            center: {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude
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
      // Enhanced mapping with complete data preservation
      const contextualPOIs = data.places.slice(0, maxResults).map((place: any) => {
        // Calculate distance from user location
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          place.location?.latitude || 0,
          place.location?.longitude || 0
        );

        return {
          placeId: place.id,
          name: place.displayName?.text || place.displayName,
          rating: place.rating,
          userRatingsTotal: place.userRatingCount,
          priceLevel: mapPriceLevel(place.priceLevel),
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
          editorialSummary: place.editorialSummary?.text,
          website: place.websiteUri,
          regularOpeningHours: place.regularOpeningHours,
          photos: place.photos || [],
          distance: Math.round(distance),
          rawGooglePlacesData: place
        }
      })

      // Sort by distance (closest first)
      contextualPOIs.sort((a, b) => a.distance - b.distance);

      console.log(`✅ Found ${contextualPOIs.length} contextual POIs within ${radius}m`)

      return new Response(
        JSON.stringify({ 
          pois: contextualPOIs, 
          total: data.places.length,
          searchRadius: radius,
          maxResults: maxResults,
          userLocation,
          success: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        pois: [], 
        total: 0, 
        searchRadius: radius, 
        maxResults: maxResults,
        userLocation,
        success: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in contextual POI search:', error)
    return new Response(
      JSON.stringify({ error: error.message, pois: [], total: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}