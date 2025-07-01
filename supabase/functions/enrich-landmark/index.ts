
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface EnrichmentRequest {
  landmarks: Array<{
    name: string;
    coordinates: [number, number]; // [lng, lat]
    description: string;
    place_id?: string;
  }>;
}

interface EnrichedLandmark {
  name: string;
  coordinates: [number, number];
  description: string;
  place_id?: string;
  enrichment_status: 'success' | 'failed' | 'not_found';
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    const { landmarks }: EnrichmentRequest = await req.json()
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    
    if (!googleApiKey) {
      throw new Error('Google API key not configured')
    }

    if (!landmarks || !Array.isArray(landmarks)) {
      throw new Error('Landmarks array is required')
    }

    console.log(`Starting enrichment for ${landmarks.length} landmarks`)
    
    const enrichedLandmarks: EnrichedLandmark[] = []
    
    // Process landmarks sequentially to avoid rate limiting
    for (let i = 0; i < landmarks.length; i++) {
      const landmark = landmarks[i]
      console.log(`Processing landmark ${i + 1}/${landmarks.length}: ${landmark.name}`)
      
      try {
        // If landmark already has place_id, skip enrichment
        if (landmark.place_id) {
          enrichedLandmarks.push({
            ...landmark,
            enrichment_status: 'success'
          })
          console.log(`Skipping ${landmark.name} - already has place_id`)
          continue
        }

        // Use Google Places API v1 searchText endpoint
        const searchUrl = 'https://places.googleapis.com/v1/places:searchText'
        
        const requestBody = {
          textQuery: landmark.name,
          maxResultCount: 5, // Get multiple results to find best match
          locationBias: {
            circle: {
              center: {
                latitude: landmark.coordinates[1],  // latitude
                longitude: landmark.coordinates[0]  // longitude
              },
              radius: 5000 // 5km radius for location bias
            }
          }
        }
        
        const response = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': googleApiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types'
          },
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Places API error for ${landmark.name}:`, errorText)
          enrichedLandmarks.push({
            ...landmark,
            enrichment_status: 'failed',
            error: `API error: ${response.status}`
          })
          continue
        }

        const data = await response.json()
        
        if (data.places && data.places.length > 0) {
          // Find the best match based on location proximity and name similarity
          let bestMatch = data.places[0]
          let bestScore = 0
          
          for (const place of data.places) {
            let score = 0
            
            // Location proximity score (higher is better)
            if (place.location) {
              const distance = calculateDistance(
                landmark.coordinates[1], landmark.coordinates[0],
                place.location.latitude, place.location.longitude
              )
              // Give higher score for closer locations (max 50 points)
              score += Math.max(0, 50 - (distance / 100)) // 100m = 1 point reduction
            }
            
            // Name similarity score (simple check)
            if (place.displayName?.text) {
              const nameSimilarity = calculateNameSimilarity(landmark.name, place.displayName.text)
              score += nameSimilarity * 50 // max 50 points for name similarity
            }
            
            if (score > bestScore) {
              bestScore = score
              bestMatch = place
            }
          }
          
          enrichedLandmarks.push({
            ...landmark,
            place_id: bestMatch.id,
            enrichment_status: 'success'
          })
          
          console.log(`✅ Enriched ${landmark.name} with place_id: ${bestMatch.id} (score: ${bestScore.toFixed(1)})`)
        } else {
          enrichedLandmarks.push({
            ...landmark,
            enrichment_status: 'not_found',
            error: 'No places found in API response'
          })
          console.log(`❌ No places found for ${landmark.name}`)
        }
        
        // Add delay to respect rate limits (1 request per 100ms)
        if (i < landmarks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
      } catch (error) {
        console.error(`Error processing ${landmark.name}:`, error)
        enrichedLandmarks.push({
          ...landmark,
          enrichment_status: 'failed',
          error: error.message
        })
      }
    }
    
    const successCount = enrichedLandmarks.filter(l => l.enrichment_status === 'success').length
    const failedCount = enrichedLandmarks.filter(l => l.enrichment_status === 'failed').length
    const notFoundCount = enrichedLandmarks.filter(l => l.enrichment_status === 'not_found').length
    
    console.log(`Enrichment complete: ${successCount} success, ${failedCount} failed, ${notFoundCount} not found`)

    return new Response(JSON.stringify({ 
      enrichedLandmarks,
      summary: {
        total: landmarks.length,
        success: successCount,
        failed: failedCount,
        notFound: notFoundCount
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in enrich-landmark function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

// Helper function to calculate distance between two coordinates (in meters)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180
  const φ2 = lat2 * Math.PI/180
  const Δφ = (lat2-lat1) * Math.PI/180
  const Δλ = (lon2-lon1) * Math.PI/180

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  return R * c
}

// Helper function to calculate name similarity (simple approach)
function calculateNameSimilarity(name1: string, name2: string): number {
  const n1 = name1.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  const n2 = name2.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  
  // Simple word matching approach
  const words1 = n1.split(/\s+/)
  const words2 = n2.split(/\s+/)
  
  let matches = 0
  for (const word1 of words1) {
    if (word1.length > 2) { // Only count words longer than 2 characters
      for (const word2 of words2) {
        if (word1.includes(word2) || word2.includes(word1)) {
          matches++
          break
        }
      }
    }
  }
  
  return matches / Math.max(words1.length, words2.length)
}
