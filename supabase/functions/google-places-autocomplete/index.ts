
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

    console.log('Autocomplete search for:', input, 'with types:', types, 'sessionToken:', sessionToken?.substring(0, 8) + '...')

    // Use Google Places API v1 autocomplete endpoint with correct structure
    const autocompleteUrl = 'https://places.googleapis.com/v1/places:autocomplete'
    
    // Build request body according to Google's recommendations
    const requestBody: any = {
      input: input,
      includedPrimaryTypes: Array.isArray(types) ? types : [types],
      languageCode: 'en'
    }

    // Add session token if provided (recommended by Google for billing optimization)
    if (sessionToken) {
      requestBody.sessionToken = sessionToken
    }

    // Add location bias if provided (improves result relevance)
    if (locationBias) {
      requestBody.locationBias = locationBias
    }

    const response = await fetch(autocompleteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        // Fixed field mask - use predictions.placePrediction instead of suggestions.placePrediction
        'X-Goog-FieldMask': 'predictions.placePrediction.placeId,predictions.placePrediction.displayName,predictions.placePrediction.types,predictions.placePrediction.formattedAddress'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google Places Autocomplete API error:', errorText)
      throw new Error(`Google Places API request failed: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('Autocomplete response received:', data.predictions?.length || 0, 'predictions')

    // Map new API response to format expected by the component
    const predictions = data.predictions?.map((prediction: any) => {
      const placePrediction = prediction.placePrediction
      return {
        place_id: placePrediction.placeId,
        description: placePrediction.formattedAddress || placePrediction.displayName?.text || '',
        types: placePrediction.types || [],
        structured_formatting: {
          main_text: placePrediction.displayName?.text || '',
          secondary_text: placePrediction.formattedAddress || ''
        }
      }
    }) || []

    return new Response(
      JSON.stringify({ 
        predictions,
        status: 'OK'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in autocomplete:', error)
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
