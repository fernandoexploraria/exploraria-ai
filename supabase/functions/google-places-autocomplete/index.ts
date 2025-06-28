
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  console.log('🚀 DEBUG: Function started - basic entry point reached')
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🚀 DEBUG: CORS preflight request handled')
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    console.log('🚀 DEBUG: Main try block entered')
    console.log('🚀 DEBUG: Request method:', req.method)
    console.log('🚀 DEBUG: Request URL:', req.url)
    
    // Step 1: Check if we can access environment variables
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    console.log('🚀 DEBUG: Google API Key exists:', googleApiKey ? 'YES' : 'NO')
    console.log('🚀 DEBUG: Google API Key length:', googleApiKey ? googleApiKey.length : 0)
    
    if (!googleApiKey) {
      console.log('❌ DEBUG: Google API key not found in environment')
      return new Response(
        JSON.stringify({ 
          error: 'Google API key not configured',
          debug: 'GOOGLE_API_KEY environment variable is missing',
          predictions: [],
          status: 'ERROR'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 500 
        }
      )
    }

    // Step 2: Try to parse request body
    console.log('🚀 DEBUG: Attempting to parse request body...')
    let requestBody
    try {
      requestBody = await req.json()
      console.log('🚀 DEBUG: Request body parsed successfully')
      console.log('🚀 DEBUG: Request body keys:', Object.keys(requestBody || {}))
    } catch (parseError) {
      console.error('❌ DEBUG: Failed to parse request body:', parseError.message)
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON in request body',
          debug: parseError.message,
          predictions: [],
          status: 'ERROR'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 400 
        }
      )
    }

    const { input, types, sessionToken, locationBias } = requestBody || {}
    
    console.log('🚀 DEBUG: Input:', input)
    console.log('🚀 DEBUG: Input length:', input ? input.length : 0)
    console.log('🚀 DEBUG: Session token exists:', sessionToken ? 'YES' : 'NO')
    console.log('🚀 DEBUG: Location bias exists:', locationBias ? 'YES' : 'NO')

    // Return empty predictions for short input (no API call needed)
    if (!input || input.length < 3) {
      console.log('🚀 DEBUG: Input too short, returning empty predictions')
      return new Response(
        JSON.stringify({ 
          predictions: [], 
          status: 'OK',
          debug: 'Input too short - no API call made'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Test Google API call with minimal parameters
    console.log('🚀 DEBUG: Preparing Google API call...')
    
    const autocompleteUrl = 'https://places.googleapis.com/v1/places:autocomplete'
    console.log('🚀 DEBUG: API URL:', autocompleteUrl)

    // Build minimal request body for Google Places API
    const googleRequestBody = {
      input: input,
      languageCode: 'en'
    }

    // Only add optional parameters if they exist
    if (Array.isArray(types) && types.length > 0) {
      googleRequestBody.includedPrimaryTypes = types
      console.log('🚀 DEBUG: Added types:', types)
    }

    if (sessionToken) {
      googleRequestBody.sessionToken = sessionToken
      console.log('🚀 DEBUG: Added session token')
    }

    if (locationBias) {
      googleRequestBody.locationBias = locationBias
      console.log('🚀 DEBUG: Added location bias')
    }

    console.log('🚀 DEBUG: Final request body:', JSON.stringify(googleRequestBody, null, 2))

    // Use simplified field mask for debugging
    const fieldMask = 'predictions.placePrediction.placeId,predictions.placePrediction.displayName'
    console.log('🚀 DEBUG: Using field mask:', fieldMask)

    console.log('🚀 DEBUG: Making Google API request...')
    
    const googleResponse = await fetch(autocompleteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': fieldMask
      },
      body: JSON.stringify(googleRequestBody)
    })

    console.log('🚀 DEBUG: Google API response status:', googleResponse.status)
    console.log('🚀 DEBUG: Google API response ok:', googleResponse.ok)

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text()
      console.error('❌ DEBUG: Google Places API error:', errorText)
      
      return new Response(
        JSON.stringify({ 
          error: `Google Places API error: ${googleResponse.status}`,
          debug: errorText,
          predictions: [],
          status: 'ERROR'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 500 
        }
      )
    }

    console.log('🚀 DEBUG: Google API call successful, parsing response...')
    
    let googleApiData
    try {
      googleApiData = await googleResponse.json()
      console.log('🚀 DEBUG: Google API response parsed successfully')
      console.log('🚀 DEBUG: Response has predictions:', googleApiData.predictions ? 'YES' : 'NO')
      console.log('🚀 DEBUG: Predictions count:', googleApiData.predictions ? googleApiData.predictions.length : 0)
    } catch (parseError) {
      console.error('❌ DEBUG: Failed to parse Google API response:', parseError.message)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse Google API response',
          debug: parseError.message,
          predictions: [],
          status: 'ERROR'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 500 
        }
      )
    }

    // Process predictions with minimal processing for debugging
    const predictions = googleApiData.predictions || []
    console.log('🚀 DEBUG: Starting to process predictions...')
    
    const processedPredictions = []
    
    for (let i = 0; i < predictions.length; i++) {
      try {
        const prediction = predictions[i]
        const placePrediction = prediction?.placePrediction
        
        if (!placePrediction) {
          console.log(`⚠️ DEBUG: No placePrediction in prediction ${i}`)
          continue
        }
        
        // Minimal processing - just extract basic fields
        const placeId = placePrediction.placeId || `fallback-${Date.now()}-${i}`
        const displayName = placePrediction.displayName?.text || 
                           placePrediction.displayName || 
                           'Unknown place'
        
        const processedPrediction = {
          place_id: placeId,
          description: displayName,
          types: placePrediction.types || [],
          structured_formatting: {
            main_text: displayName,
            secondary_text: ''
          }
        }
        
        console.log(`🚀 DEBUG: Processed prediction ${i + 1}:`, processedPrediction.place_id)
        processedPredictions.push(processedPrediction)
        
      } catch (predictionError) {
        console.error(`❌ DEBUG: Error processing prediction ${i + 1}:`, predictionError.message)
        continue
      }
    }

    console.log(`🚀 DEBUG: Successfully processed ${processedPredictions.length} predictions`)
    
    const finalResponse = {
      predictions: processedPredictions,
      status: 'OK',
      debug: `Processed ${processedPredictions.length} predictions successfully`
    }
    
    console.log('🚀 DEBUG: Returning final response')

    return new Response(
      JSON.stringify(finalResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 DEBUG: Unhandled error in function:', error.message)
    console.error('💥 DEBUG: Error stack:', error.stack)
    console.error('💥 DEBUG: Error name:', error.name)
    
    return new Response(
      JSON.stringify({ 
        error: `Internal server error: ${error.message}`, 
        debug: error.stack,
        predictions: [],
        status: 'ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    )
  }
})
