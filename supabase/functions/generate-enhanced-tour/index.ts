
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { destination } = await req.json()

    if (!destination) {
      return new Response(
        JSON.stringify({ error: 'Destination is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseClient.auth.getUser(token)
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Record generation start time for analytics
    const generationStartTime = new Date().toISOString()
    const startTimestamp = Date.now()

    console.log(`Starting enhanced tour generation for destination: ${destination}`)

    // Generate system prompt using Gemini AI
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${Deno.env.get('GOOGLE_AI_API_KEY')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Generate a comprehensive list of exactly 15 must-visit landmarks for ${destination}. 

For each landmark, provide:
1. The exact name (be specific - include proper names)
2. A detailed 2-3 sentence description explaining why it's significant
3. Only include real, verifiable landmarks - no fictional places

Format your response as a JSON array with this structure:
[
  {
    "name": "Exact landmark name",
    "description": "Detailed description explaining significance and what visitors can expect"
  }
]

Focus on a mix of:
- Iconic historical sites and monuments
- Museums and cultural institutions  
- Architectural marvels
- Natural landmarks and parks
- Religious or spiritual sites
- Markets, neighborhoods, or districts
- Viewpoints and observation areas

Ensure geographic diversity across the destination. Be specific with names - use full official names when available.`
          }]
        }]
      })
    })

    if (!geminiResponse.ok) {
      const error = await geminiResponse.text()
      console.error('Gemini API error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to generate landmarks with AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const geminiData = await geminiResponse.json()
    const generatedText = geminiData.candidates[0].content.parts[0].text

    // Extract JSON from the response
    const jsonMatch = generatedText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('No valid JSON found in Gemini response')
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let landmarks
    try {
      landmarks = JSON.parse(jsonMatch[0])
    } catch (e) {
      console.error('Failed to parse landmarks JSON:', e)
      return new Response(
        JSON.stringify({ error: 'Failed to parse landmarks data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Generated ${landmarks.length} landmarks, now enhancing with coordinates...`)

    // Process landmarks to get coordinates and enhanced data
    const enhancedLandmarks = []
    const coordinateQuality = { highConfidence: 0, mediumConfidence: 0, lowConfidence: 0 }
    const processingMetrics = {
      geminiApiCalls: 1,
      placesApiCalls: 0,
      totalApiCalls: 1,
      fallbacksUsed: [],
      errors: []
    }

    for (const [index, landmark] of landmarks.entries()) {
      console.log(`Processing landmark ${index + 1}/${landmarks.length}: ${landmark.name}`)
      
      const landmarkStartTime = Date.now()
      let searchAttempts = 0
      let coordinateRefinementAttempts = 0
      let apiCallsForThisLandmark = 0
      let fallbackMethodsUsed = []
      let errorMessages = []

      try {
        // Search for the landmark using Google Places API
        const searchQuery = `${landmark.name} ${destination}`
        searchAttempts++
        apiCallsForThisLandmark++
        processingMetrics.placesApiCalls++
        
        const searchResponse = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${Deno.env.get('GOOGLE_API_KEY')}`)
        
        if (!searchResponse.ok) {
          throw new Error(`Places API search failed: ${searchResponse.status}`)
        }

        const searchData = await searchResponse.json()

        if (searchData.results && searchData.results.length > 0) {
          const place = searchData.results[0]
          
          // Get detailed place information
          if (place.place_id) {
            apiCallsForThisLandmark++
            processingMetrics.placesApiCalls++
            
            const detailsResponse = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,geometry,rating,photos,types&key=${Deno.env.get('GOOGLE_API_KEY')}`)
            
            if (detailsResponse.ok) {
              const detailsData = await detailsResponse.json()
              
              if (detailsData.result) {
                const result = detailsData.result
                
                // Process photos
                let photos = []
                if (result.photos && result.photos.length > 0) {
                  photos = result.photos.slice(0, 3).map(photo => ({
                    reference: photo.photo_reference,
                    width: photo.width,
                    height: photo.height
                  }))
                }

                // Determine coordinate confidence based on place data quality
                let confidence = 'low'
                let coordinateSource = 'places_search'
                
                if (result.geometry?.location && result.place_id && result.rating) {
                  if (result.types && result.types.includes('tourist_attraction')) {
                    confidence = 'high'
                    coordinateQuality.highConfidence++
                  } else {
                    confidence = 'medium'
                    coordinateQuality.mediumConfidence++
                  }
                } else {
                  coordinateQuality.lowConfidence++
                  fallbackMethodsUsed.push('basic_search')
                }

                const processingTime = Date.now() - landmarkStartTime

                enhancedLandmarks.push({
                  id: `landmark-${index + 1}`,
                  name: result.name || landmark.name,
                  coordinates: [result.geometry.location.lng, result.geometry.location.lat],
                  description: landmark.description,
                  placeId: result.place_id,
                  coordinateSource,
                  confidence,
                  rating: result.rating || null,
                  photos,
                  types: result.types || [],
                  formattedAddress: result.formatted_address || null,
                  // Analytics data
                  searchQuery,
                  searchAttempts,
                  coordinateRefinementAttempts,
                  apiCallsForThisLandmark,
                  fallbackMethodsUsed,
                  processingTimeMs: processingTime,
                  errorMessages
                })

                console.log(`✓ Enhanced ${landmark.name} with ${confidence} confidence coordinates`)
                continue
              }
            }
          }
        }

        // Fallback: use geocoding API
        fallbackMethodsUsed.push('geocoding_fallback')
        apiCallsForThisLandmark++
        processingMetrics.placesApiCalls++
        
        const geocodeResponse = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${Deno.env.get('GOOGLE_API_KEY')}`)
        
        if (geocodeResponse.ok) {
          const geocodeData = await geocodeResponse.json()
          
          if (geocodeData.results && geocodeData.results.length > 0) {
            const location = geocodeData.results[0].geometry.location
            const processingTime = Date.now() - landmarkStartTime
            
            coordinateQuality.lowConfidence++
            
            enhancedLandmarks.push({
              id: `landmark-${index + 1}`,
              name: landmark.name,
              coordinates: [location.lng, location.lat],
              description: landmark.description,
              placeId: null,
              coordinateSource: 'geocoding_fallback',
              confidence: 'low',
              rating: null,
              photos: [],
              types: [],
              formattedAddress: geocodeData.results[0].formatted_address,
              // Analytics data
              searchQuery,
              searchAttempts,
              coordinateRefinementAttempts,
              apiCallsForThisLandmark,
              fallbackMethodsUsed,
              processingTimeMs: processingTime,
              errorMessages
            })
            
            console.log(`⚠ Used geocoding fallback for ${landmark.name}`)
            continue
          }
        }

        throw new Error('All coordinate resolution methods failed')

      } catch (error) {
        console.error(`Failed to enhance landmark ${landmark.name}:`, error)
        const errorMsg = error.message || 'Unknown error during landmark processing'
        errorMessages.push(errorMsg)
        processingMetrics.errors.push(errorMsg)
        
        // Create landmark with null coordinates as last resort
        const processingTime = Date.now() - landmarkStartTime
        coordinateQuality.lowConfidence++
        
        enhancedLandmarks.push({
          id: `landmark-${index + 1}`,
          name: landmark.name,
          coordinates: [0, 0], // Default coordinates
          description: landmark.description,
          placeId: null,
          coordinateSource: 'failed',
          confidence: 'low',
          rating: null,
          photos: [],
          types: [],
          formattedAddress: null,
          // Analytics data
          searchQuery: `${landmark.name} ${destination}`,
          searchAttempts,
          coordinateRefinementAttempts,
          apiCallsForThisLandmark,
          fallbackMethodsUsed: [...fallbackMethodsUsed, 'coordinate_resolution_failed'],
          processingTimeMs: processingTime,
          errorMessages
        })
      }
    }

    const totalProcessingTime = Date.now() - startTimestamp
    const generationEndTime = new Date().toISOString()

    // Calculate success rate
    const successfulLandmarks = enhancedLandmarks.filter(l => l.coordinateSource !== 'failed').length
    const successRate = (successfulLandmarks / enhancedLandmarks.length) * 100

    console.log(`Enhanced tour generation completed in ${totalProcessingTime}ms`)
    console.log(`Success rate: ${successRate.toFixed(1)}% (${successfulLandmarks}/${enhancedLandmarks.length} landmarks)`)
    console.log(`Coordinate quality: ${coordinateQuality.highConfidence} high, ${coordinateQuality.mediumConfidence} medium, ${coordinateQuality.lowConfidence} low`)

    // Prepare the response data
    const responseData = {
      landmarks: enhancedLandmarks,
      systemPrompt: generatedText,
      metadata: {
        totalLandmarks: enhancedLandmarks.length,
        coordinateQuality,
        processingTime: totalProcessingTime,
        fallbacksUsed: [...new Set(processingMetrics.fallbacksUsed)],
        apiCalls: {
          gemini: processingMetrics.geminiApiCalls,
          places: processingMetrics.placesApiCalls,
          total: processingMetrics.geminiApiCalls + processingMetrics.placesApiCalls
        }
      }
    }

    // Start background analytics data storage (non-blocking)
    const analyticsTask = async () => {
      try {
        console.log('Starting background analytics data storage...')
        
        // Insert tour record
        const { data: tourData, error: tourError } = await supabaseClient
          .from('generated_tours')
          .insert({
            user_id: user.id,
            destination,
            system_prompt: generatedText,
            total_landmarks: enhancedLandmarks.length,
            generation_start_time: generationStartTime,
            generation_end_time: generationEndTime,
            total_processing_time_ms: totalProcessingTime,
            coordinate_quality_high: coordinateQuality.highConfidence,
            coordinate_quality_medium: coordinateQuality.mediumConfidence,
            coordinate_quality_low: coordinateQuality.lowConfidence,
            fallbacks_used: [...new Set(processingMetrics.fallbacksUsed.concat(...enhancedLandmarks.flatMap(l => l.fallbackMethodsUsed)))],
            gemini_api_calls: processingMetrics.geminiApiCalls,
            places_api_calls: processingMetrics.placesApiCalls,
            success_rate: successRate,
            error_count: processingMetrics.errors.length
          })
          .select()
          .single()

        if (tourError) {
          console.error('Error storing tour analytics:', tourError)
          return
        }

        const tourId = tourData.id
        console.log(`Stored tour analytics with ID: ${tourId}`)

        // Insert landmark records in batches
        const landmarkInserts = enhancedLandmarks.map(landmark => ({
          tour_id: tourId,
          landmark_id: landmark.id,
          name: landmark.name,
          coordinates: `(${landmark.coordinates[0]},${landmark.coordinates[1]})`,
          description: landmark.description,
          place_id: landmark.placeId,
          coordinate_source: landmark.coordinateSource,
          confidence: landmark.confidence,
          rating: landmark.rating,
          types: landmark.types,
          formatted_address: landmark.formattedAddress,
          photos: landmark.photos,
          search_query: landmark.searchQuery,
          search_attempts: landmark.searchAttempts,
          coordinate_refinement_attempts: landmark.coordinateRefinementAttempts,
          api_calls_made: landmark.apiCallsForThisLandmark,
          fallback_methods_used: landmark.fallbackMethodsUsed,
          processing_time_ms: landmark.processingTimeMs,
          error_messages: landmark.errorMessages
        }))

        const { error: landmarksError } = await supabaseClient
          .from('generated_landmarks')
          .insert(landmarkInserts)

        if (landmarksError) {
          console.error('Error storing landmark analytics:', landmarksError)
          return
        }

        console.log(`Stored ${landmarkInserts.length} landmark analytics records`)

        // Insert generation logs
        const logEntries = [
          {
            tour_id: tourId,
            log_level: 'info',
            phase: 'generation_start',
            message: `Started tour generation for destination: ${destination}`,
            metadata: { destination, user_id: user.id }
          },
          {
            tour_id: tourId,
            log_level: 'info',
            phase: 'ai_generation',
            message: 'Gemini AI landmark generation completed',
            execution_time_ms: null,
            api_endpoint: 'generativelanguage.googleapis.com',
            metadata: { landmarks_generated: landmarks.length }
          },
          {
            tour_id: tourId,
            log_level: 'info',
            phase: 'coordinate_enhancement',
            message: 'Coordinate enhancement phase completed',
            execution_time_ms: totalProcessingTime,
            metadata: {
              total_api_calls: processingMetrics.geminiApiCalls + processingMetrics.placesApiCalls,
              success_rate: successRate,
              coordinate_quality: coordinateQuality
            }
          },
          {
            tour_id: tourId,
            log_level: 'info',
            phase: 'generation_complete',
            message: `Tour generation completed successfully`,
            execution_time_ms: totalProcessingTime,
            metadata: {
              total_landmarks: enhancedLandmarks.length,
              processing_time_ms: totalProcessingTime,
              api_usage: {
                gemini: processingMetrics.geminiApiCalls,
                places: processingMetrics.placesApiCalls
              }
            }
          }
        ]

        // Add error logs if any
        if (processingMetrics.errors.length > 0) {
          logEntries.push({
            tour_id: tourId,
            log_level: 'warning',
            phase: 'coordinate_enhancement',
            message: `Encountered ${processingMetrics.errors.length} errors during processing`,
            error_details: { errors: processingMetrics.errors },
            metadata: { error_count: processingMetrics.errors.length }
          })
        }

        const { error: logsError } = await supabaseClient
          .from('tour_generation_logs')
          .insert(logEntries)

        if (logsError) {
          console.error('Error storing generation logs:', logsError)
          return
        }

        console.log(`Stored ${logEntries.length} generation log entries`)
        console.log('Background analytics data storage completed successfully')

      } catch (error) {
        console.error('Error in background analytics storage:', error)
      }
    }

    // Use EdgeRuntime.waitUntil to ensure background task completes
    EdgeRuntime.waitUntil(analyticsTask())

    // Return the tour data immediately (non-blocking)
    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in generate-enhanced-tour:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
