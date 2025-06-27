
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Dynamic radius mapping based on destination types
const RADIUS_MAPPING = {
  'museum': 1500,
  'art_gallery': 1500,
  'stadium': 2000,
  'park': 3500,
  'tourist_attraction': 3000,
  'sublocality': 5500,
  'neighborhood': 6000,
  'locality': 10000,
  'administrative_area_level_2': 15000,
  'administrative_area_level_1': 25000,
  'political': 12000,
  'country': 50000,
  // Default fallback
  'default': 5000
};

// Landmark types we're interested in discovering
const LANDMARK_TYPES = [
  'tourist_attraction',
  'museum',
  'park',
  'landmark',
  'art_gallery',
  'historical_place',
  'cultural_landmark',
  'monument',
  'performing_arts_theater',
  'national_park',
  'amusement_park',
  'zoo',
  'aquarium',
  'stadium',
  'visitor_center',
  'botanical_garden',
  'plaza',
  'library',
  'university',
  'church',
  'synagogue',
  'mosque',
  'hindu_temple',
  'cemetery'
];

// Priority weighting for different landmark types
const LANDMARK_PRIORITY = {
  'museum': 10,
  'landmark': 9,
  'tourist_attraction': 8,
  'art_gallery': 8,
  'monument': 7,
  'historical_place': 7,
  'cultural_landmark': 7,
  'park': 6,
  'performing_arts_theater': 6,
  'botanical_garden': 5,
  'zoo': 5,
  'aquarium': 5,
  'stadium': 5,
  'national_park': 4,
  'amusement_park': 4,
  'plaza': 3,
  'library': 3,
  'university': 3,
  'church': 2,
  'synagogue': 2,
  'mosque': 2,
  'hindu_temple': 2,
  'cemetery': 1,
  'visitor_center': 1
};

function determineDynamicRadius(destinationTypes: string[]): number {
  let maxRadius = RADIUS_MAPPING.default;
  
  for (const type of destinationTypes) {
    const radius = RADIUS_MAPPING[type as keyof typeof RADIUS_MAPPING];
    if (radius && radius > maxRadius) {
      maxRadius = radius;
    }
  }
  
  return maxRadius;
}

function calculateLandmarkPriority(landmarkTypes: string[]): number {
  let maxPriority = 0;
  
  for (const type of landmarkTypes) {
    const priority = LANDMARK_PRIORITY[type as keyof typeof LANDMARK_PRIORITY];
    if (priority && priority > maxPriority) {
      maxPriority = priority;
    }
  }
  
  return maxPriority || 1;
}

function filterAndSortLandmarks(places: any[]): any[] {
  // Filter out low-quality places
  const filtered = places.filter(place => {
    // Must have a rating of at least 3.5 or no rating data
    if (place.rating && place.rating < 3.5 && place.userRatingCount > 10) {
      return false;
    }
    
    // Must have at least some reviews if it has a rating
    if (place.rating && place.userRatingCount === 0) {
      return false;
    }
    
    return true;
  });
  
  // Sort by priority, rating, and review count
  return filtered.sort((a, b) => {
    const aPriority = calculateLandmarkPriority(a.types || []);
    const bPriority = calculateLandmarkPriority(b.types || []);
    
    if (aPriority !== bPriority) {
      return bPriority - aPriority; // Higher priority first
    }
    
    const aRating = a.rating || 0;
    const bRating = b.rating || 0;
    
    if (Math.abs(aRating - bRating) > 0.3) {
      return bRating - aRating; // Higher rating first
    }
    
    const aReviews = a.userRatingCount || 0;
    const bReviews = b.userRatingCount || 0;
    
    return bReviews - aReviews; // More reviews first
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    const { destination, userId } = await req.json()
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    
    if (!googleApiKey) {
      throw new Error('Google API key not configured')
    }

    if (!destination || !destination.location) {
      throw new Error('Valid destination with location is required')
    }

    console.log('Discovering landmarks for destination:', destination.displayName)
    console.log('Destination types:', destination.types)
    
    // Determine dynamic radius based on destination types
    const dynamicRadius = determineDynamicRadius(destination.types || []);
    console.log('Using dynamic radius:', dynamicRadius, 'meters')

    // Use new Places API v1 searchNearby endpoint
    const searchUrl = 'https://places.googleapis.com/v1/places:searchNearby'
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.types,places.formattedAddress,places.editorialSummary,places.rating,places.userRatingCount,places.photos,places.websiteUri,places.internationalPhoneNumber,places.regularOpeningHours'
      },
      body: JSON.stringify({
        includedTypes: LANDMARK_TYPES,
        locationRestriction: {
          circle: {
            center: {
              latitude: destination.location.lat,
              longitude: destination.location.lng
            },
            radius: dynamicRadius
          }
        },
        rankPreference: 'POPULARITY',
        languageCode: 'en',
        maxResultCount: 20
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Places API search error:', errorText)
      throw new Error(`Places API request failed: ${response.status}`)
    }

    const data = await response.json()
    console.log('Places API response received:', data.places?.length || 0, 'places')

    if (!data.places || data.places.length === 0) {
      return new Response(
        JSON.stringify({ 
          landmarks: [], 
          message: 'No landmarks found in this area',
          radiusUsed: dynamicRadius 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process and enhance the landmark data
    const processedLandmarks = data.places.map((place: any) => ({
      placeId: place.id,
      displayName: place.displayName?.text || place.displayName,
      formattedAddress: place.formattedAddress,
      location: {
        lat: place.location?.latitude || 0,
        lng: place.location?.longitude || 0
      },
      types: place.types || [],
      rating: place.rating,
      userRatingCount: place.userRatingCount,
      editorialSummary: place.editorialSummary?.text,
      photos: place.photos?.slice(0, 3).map((photo: any) => 
        `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=400&key=${googleApiKey}`
      ) || [],
      websiteUri: place.websiteUri,
      internationalPhoneNumber: place.internationalPhoneNumber,
      openingHours: place.regularOpeningHours?.weekdayDescriptions || []
    }));

    // Filter and sort landmarks by quality and relevance
    const qualityLandmarks = filterAndSortLandmarks(processedLandmarks);
    
    // Take top 12 landmarks for the tour
    const selectedLandmarks = qualityLandmarks.slice(0, 12);
    
    console.log('Selected', selectedLandmarks.length, 'quality landmarks for tour')

    // Store landmarks in database
    if (userId && selectedLandmarks.length > 0) {
      // Import Supabase client for server-side use
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      // Find the most recent tour for this user and destination
      const { data: tourData, error: tourError } = await supabase
        .from('generated_tours')
        .select('id')
        .eq('user_id', userId)
        .eq('destination', destination.displayName)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (!tourError && tourData) {
        // Prepare landmarks for database insertion
        const landmarksToInsert = selectedLandmarks.map(landmark => ({
          tour_id: tourData.id,
          landmark_id: landmark.placeId,
          name: landmark.displayName,
          coordinates: `(${landmark.location.lng},${landmark.location.lat})`,
          description: landmark.editorialSummary || `A ${landmark.types[0]?.replace(/_/g, ' ')} in ${destination.displayName}`,
          place_id: landmark.placeId,
          formatted_address: landmark.formattedAddress,
          types: landmark.types,
          rating: landmark.rating,
          photos: JSON.stringify(landmark.photos),
          confidence: 'high',
          coordinate_source: 'google_places_nearby',
          created_at: new Date().toISOString()
        }))
        
        // Insert landmarks
        const { error: insertError } = await supabase
          .from('generated_landmarks')
          .insert(landmarksToInsert)
        
        if (insertError) {
          console.error('Error storing landmarks:', insertError)
        } else {
          console.log('Successfully stored', landmarksToInsert.length, 'landmarks')
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        landmarks: selectedLandmarks,
        totalFound: data.places.length,
        radiusUsed: dynamicRadius,
        success: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error discovering landmarks:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        landmarks: [] 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    )
  }
})
