
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
    const { 
      input, 
      types = ['locality', 'sublocality', 'tourist_attraction', 'park', 'museum'],
      sessionToken,
      locationBias 
    } = await req.json()
    
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
        JSON.stringify({ predictions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔍 Starting autocomplete request:')
    console.log('  - Input:', input)
    console.log('  - Types:', types)
    console.log('  - Session Token:', sessionToken ? `${sessionToken.substring(0, 8)}...` : 'none')
    console.log('  - Location Bias:', locationBias ? 'provided' : 'none')

    const autocompleteUrl = 'https://places.googleapis.com/v1/places:autocomplete'
    
    // Build request body according to Google's specification
    const requestBody: any = {
      input: input,
      languageCode: 'en'
    }

    // Add included primary types if provided - map from 'types' parameter
    if (Array.isArray(types) && types.length > 0) {
      requestBody.includedPrimaryTypes = types
    }

    // Add session token if provided (crucial for billing optimization)
    if (sessionToken) {
      requestBody.sessionToken = sessionToken
    }

    // Add location bias if provided
    if (locationBias) {
      requestBody.locationBias = locationBias
    }

    console.log('📝 Request body:', JSON.stringify(requestBody, null, 2))

    // Use the correct field mask for Google Places API (New)
    const fieldMask = 'predictions.place_id,predictions.description,predictions.types,predictions.structured_formatting'

    console.log('🎯 Field mask:', fieldMask)

    const response = await fetch(autocompleteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': fieldMask
      },
      body: JSON.stringify(requestBody)
    })

    console.log('📡 API Response status:', response.status)
    console.log('📡 API Response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Google Places Autocomplete API error:')
      console.error('  - Status:', response.status)
      console.error('  - Response:', errorText)
      
      // Try to parse error details
      try {
        const errorJson = JSON.parse(errorText)
        console.error('  - Parsed error:', JSON.stringify(errorJson, null, 2))
      } catch (e) {
        console.error('  - Could not parse error as JSON')
      }
      
      return new Response(
        JSON.stringify({ 
          error: `Google Places API error: ${response.status} - ${errorText}`,
          predictions: [],
          status: 'ERROR'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 500 
        }
      )
    }

    const data = await response.json()
    console.log('✅ Raw API response:', JSON.stringify(data, null, 2))

    // Process the response - Google Places API returns predictions directly
    const predictions = data.predictions || []
    console.log('📊 Number of predictions received:', predictions.length)

    // Map predictions to the format expected by the frontend
    const mappedPredictions = predictions.map((prediction: any, index: number) => {
      console.log(`🔄 Processing prediction ${index + 1}:`, JSON.stringify(prediction, null, 2))
      
      // Extract required fields - Google Places API (New) uses different structure
      const placeId = prediction.place_id
      const description = prediction.description || ''
      const types = prediction.types || []
      
      // Handle structured formatting for better UI display
      const structuredFormatting = prediction.structured_formatting || {}
      const mainText = structuredFormatting.main_text || description
      const secondaryText = structuredFormatting.secondary_text || ''
      
      const result = {
        place_id: placeId,
        description: description,
        types: types,
        structured_formatting: {
          main_text: mainText,
          secondary_text: secondaryText
        }
      }
      
      console.log(`✅ Mapped prediction ${index + 1}:`, JSON.stringify(result, null, 2))
      return result
    }).filter(Boolean) // Remove any null results

    console.log('🎉 Final response:', mappedPredictions.length, 'predictions mapped successfully')

    return new Response(
      JSON.stringify({ 
        predictions: mappedPredictions,
        status: 'OK'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 Error in autocomplete function:', error)
    console.error('💥 Error stack:', error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: error.message, 
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
