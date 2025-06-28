

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    console.log('🚀 Edge Function started - processing autocomplete request')
    
    const requestBody = await req.json()
    console.log('📥 Incoming request body:', JSON.stringify(requestBody, null, 2))
    
    const { 
      input, 
      types = ['locality', 'sublocality', 'tourist_attraction', 'park', 'museum'],
      sessionToken,
      locationBias 
    } = requestBody
    
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    
    if (!googleApiKey) {
      console.error('❌ Google API key not configured')
      return new Response(
        JSON.stringify({ 
          error: 'Google API key not configured',
          predictions: [],
          status: 'ERROR'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 500 
        }
      )
    }

    // Return empty predictions for short input
    if (!input || input.length < 3) {
      console.log('⚠️ Input too short, returning empty predictions')
      return new Response(
        JSON.stringify({ predictions: [], status: 'OK' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔍 Processing autocomplete request:')
    console.log('  - Input:', input)
    console.log('  - Types:', types)
    console.log('  - Session Token:', sessionToken ? `${sessionToken.substring(0, 8)}...` : 'none')
    console.log('  - Location Bias:', locationBias ? 'provided' : 'none')

    const autocompleteUrl = 'https://places.googleapis.com/v1/places:autocomplete'
    
    // Build request body for Google Places API (New)
    const googleRequestBody: any = {
      input: input,
      languageCode: 'en'
    }

    // Map frontend 'types' parameter to Google's 'includedPrimaryTypes'
    if (Array.isArray(types) && types.length > 0) {
      googleRequestBody.includedPrimaryTypes = types
    }

    if (sessionToken) {
      googleRequestBody.sessionToken = sessionToken
    }

    if (locationBias) {
      googleRequestBody.locationBias = locationBias
    }

    console.log('📤 Request to Google Places API:', JSON.stringify(googleRequestBody, null, 2))

    // Corrected field mask for Google Places API (New)
    const fieldMask = 'predictions.placePrediction.placeId,predictions.placePrediction.displayName,predictions.placePrediction.types,predictions.placePrediction.formattedAddress,predictions.placePrediction.structuredFormat,predictions.placePrediction.distanceMeters'

    console.log('🎯 Using field mask:', fieldMask)

    const googleResponse = await fetch(autocompleteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': fieldMask
      },
      body: JSON.stringify(googleRequestBody)
    })

    console.log('📡 Google API Response status:', googleResponse.status)
    console.log('📡 Google API Response headers:', Object.fromEntries(googleResponse.headers.entries()))

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text()
      console.error('❌ Google Places API error:')
      console.error('  - Status:', googleResponse.status)
      console.error('  - Response:', errorText)
      
      return new Response(
        JSON.stringify({ 
          error: `Google Places API error: ${googleResponse.status} - ${errorText}`,
          predictions: [],
          status: 'ERROR'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 500 
        }
      )
    }

    const googleApiData = await googleResponse.json()
    console.log('✅ Google API Raw Response:', JSON.stringify(googleApiData, null, 2))

    // Safely process the response
    const predictions = googleApiData.predictions || []
    console.log('📊 Number of predictions received:', predictions.length)

    if (predictions.length === 0) {
      console.log('📭 No predictions returned from Google API')
      return new Response(
        JSON.stringify({ predictions: [], status: 'OK' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process predictions with proper error handling
    const processedPredictions = []
    
    for (let i = 0; i < predictions.length; i++) {
      try {
        const prediction = predictions[i]
        console.log(`🔄 Processing prediction ${i + 1}:`, JSON.stringify(prediction, null, 2))
        
        const placePrediction = prediction.placePrediction
        
        if (!placePrediction) {
          console.warn(`⚠️ No placePrediction found in prediction ${i}:`, prediction)
          continue
        }
        
        // Safely extract fields with fallbacks
        const placeId = placePrediction.placeId || null
        const displayName = placePrediction.displayName?.text || ''
        const formattedAddress = placePrediction.formattedAddress || ''
        const types = Array.isArray(placePrediction.types) ? placePrediction.types : []
        
        // Handle structured format safely
        const structuredFormat = placePrediction.structuredFormat || {}
        const mainText = structuredFormat.mainText?.text || displayName || 'Unknown place'
        const secondaryText = structuredFormat.secondaryText?.text || formattedAddress || ''
        
        const processedPrediction = {
          place_id: placeId,
          description: mainText && secondaryText ? `${mainText}, ${secondaryText}` : mainText,
          types: types,
          structured_formatting: {
            main_text: mainText,
            secondary_text: secondaryText
          }
        }
        
        console.log(`✅ Processed prediction ${i + 1}:`, JSON.stringify(processedPrediction, null, 2))
        processedPredictions.push(processedPrediction)
        
      } catch (predictionError) {
        console.error(`❌ Error processing prediction ${i + 1}:`, predictionError.message)
        console.error('Raw prediction data:', JSON.stringify(predictions[i], null, 2))
        // Continue processing other predictions instead of failing entirely
        continue
      }
    }

    console.log(`🎉 Successfully processed ${processedPredictions.length} predictions`)
    
    const finalResponse = {
      predictions: processedPredictions,
      status: 'OK'
    }
    
    console.log('📤 Final response to frontend:', JSON.stringify(finalResponse, null, 2))

    return new Response(
      JSON.stringify(finalResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 Unhandled error in autocomplete function:', error.message)
    console.error('💥 Error stack:', error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: `Internal server error: ${error.message}`, 
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

