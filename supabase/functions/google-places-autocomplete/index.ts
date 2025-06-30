
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

    // Step 3: Test Google API call with CORRECT field mask for new API
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

    // FIXED: Use CORRECT field mask for the NEW Google Places API with types included
    const fieldMask = 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.types'
    console.log('🚀 DEBUG: Using enhanced field mask with types:', fieldMask)

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
      console.log('🚀 DEBUG: Response has suggestions:', googleApiData.suggestions ? 'YES' : 'NO')
      console.log('🚀 DEBUG: Suggestions count:', googleApiData.suggestions ? googleApiData.suggestions.length : 0)
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

    // Process suggestions with the NEW API structure and enhanced logging
    const suggestions = googleApiData.suggestions || []
    console.log('🚀 DEBUG: Starting to process suggestions...')
    
    const processedPredictions = []
    
    for (let i = 0; i < suggestions.length; i++) {
      try {
        const suggestion = suggestions[i]
        const placePrediction = suggestion?.placePrediction
        
        if (!placePrediction) {
          console.log(`⚠️ DEBUG: No placePrediction in suggestion ${i}`)
          continue
        }
        
        // Extract data using the NEW API structure
        const placeId = placePrediction.placeId || `fallback-${Date.now()}-${i}`
        const displayText = placePrediction.text?.text || 
                           placePrediction.text || 
                           'Unknown place'
        
        // CRITICAL: Extract types from the API response
        const types = placePrediction.types || []
        
        // Enhanced logging for type debugging
        console.log(`🔍 ICON DEBUG ${i + 1}: "${displayText}"`)
        console.log(`🔍 ICON DEBUG ${i + 1}: Types returned by Google:`, types)
        
        // Check if this looks like a park by name
        const nameIndicatesPark = /park|parque|jardín|garden|verde/i.test(displayText)
        if (nameIndicatesPark) {
          console.log(`🌳 PARK DETECTED by name: "${displayText}" - Types:`, types)
        }
        
        const processedPrediction = {
          place_id: placeId,
          description: displayText,
          types: types, // Now we're getting real types from Google!
          structured_formatting: {
            main_text: displayText,
            secondary_text: ''
          }
        }
        
        console.log(`✅ DEBUG: Processed suggestion ${i + 1}:`, processedPrediction.place_id)
        processedPredictions.push(processedPrediction)
        
      } catch (predictionError) {
        console.error(`❌ DEBUG: Error processing suggestion ${i + 1}:`, predictionError.message)
        continue
      }
    }

    console.log(`🚀 DEBUG: Successfully processed ${processedPredictions.length} suggestions`)
    
    const finalResponse = {
      predictions: processedPredictions,
      status: 'OK',
      debug: `Processed ${processedPredictions.length} suggestions successfully with enhanced type debugging`
    }
    
    console.log('🚀 DEBUG: Returning final response with type information')

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
