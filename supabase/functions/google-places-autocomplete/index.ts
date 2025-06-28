
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
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
      throw new Error('Google API key not configured')
    }

    if (!input || input.length < 3) {
      return new Response(
        JSON.stringify({ predictions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔍 Autocomplete search for:', input, 'with types:', types, 'sessionToken:', sessionToken?.substring(0, 8) + '...')

    const autocompleteUrl = 'https://places.googleapis.com/v1/places:autocomplete'
    
    // Build the request body
    const requestBody: any = {
      input: input,
      languageCode: 'en'
    }

    // Add types if provided
    if (Array.isArray(types) && types.length > 0) {
      requestBody.includedPrimaryTypes = types
    }

    // Add session token if provided
    if (sessionToken) {
      requestBody.sessionToken = sessionToken
    }

    // Add location bias if provided
    if (locationBias) {
      requestBody.locationBias = locationBias
    }

    console.log('🔍 Request body:', JSON.stringify(requestBody, null, 2))

    // Use the correct field mask for Google Places API (New)
    const fieldMask = 'predictions.placePrediction.placeId,predictions.placePrediction.displayName,predictions.placePrediction.types,predictions.placePrediction.formattedAddress,predictions.placePrediction.structuredFormat,predictions.placePrediction.distanceMeters'

    const response = await fetch(autocompleteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': fieldMask
      },
      body: JSON.stringify(requestBody)
    })

    console.log('🔍 Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('🔍 Google Places Autocomplete API error:', errorText)
      throw new Error(`Google Places API request failed: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('🔍 Raw API response:', JSON.stringify(data, null, 2))

    // Process the response
    const suggestions = data.suggestions || []
    
    // Map API response to format expected by the component
    const predictions = suggestions.map((item: any) => {
      const prediction = item.placePrediction
      
      if (!prediction) {
        console.warn('🔍 No placePrediction found in suggestion:', item)
        return null
      }
      
      console.log('🔍 Processing prediction:', JSON.stringify(prediction, null, 2))
      
      // Extract fields using the correct structure
      const placeId = prediction.placeId
      const displayName = prediction.displayName?.text || ''
      const formattedAddress = prediction.formattedAddress || ''
      const types = prediction.types || []
      
      // Handle structured format
      const mainText = prediction.structuredFormat?.mainText?.text || displayName
      const secondaryText = prediction.structuredFormat?.secondaryText?.text || formattedAddress
      
      const result = {
        place_id: placeId,
        description: mainText && secondaryText ? `${mainText}, ${secondaryText}` : (mainText || displayName || 'Unknown place'),
        types: types,
        structured_formatting: {
          main_text: mainText || displayName || 'Unknown place',
          secondary_text: secondaryText || formattedAddress || ''
        }
      }
      
      console.log('🔍 Mapped result:', JSON.stringify(result, null, 2))
      return result
    }).filter(Boolean) // Remove any null results

    console.log('🔍 Final mapped predictions:', predictions.length, 'results')

    return new Response(
      JSON.stringify({ 
        predictions,
        status: 'OK'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('🔍 Error in autocomplete:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        predictions: [] 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    )
  }
})
