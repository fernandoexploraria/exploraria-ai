
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

    // Use Google Places API v1 autocomplete endpoint
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
        // Correct field mask based on Gemini's guidance - use predictions.placePrediction
        'X-Goog-FieldMask': 'predictions.placePrediction.placeId,predictions.placePrediction.displayName.text,predictions.placePrediction.types,predictions.placePrediction.formattedAddress,predictions.placePrediction.structuredFormat.mainText.text,predictions.placePrediction.structuredFormat.secondaryText.text'
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
    console.log('Raw API response structure:', JSON.stringify(data, null, 2))

    // Map API response to format expected by the component - use predictions as per Gemini
    const predictions = data.predictions?.map((prediction: any) => {
      const placePrediction = prediction.placePrediction
      
      // Use displayName.text as primary, with structured format as fallback
      const mainText = placePrediction.structuredFormat?.mainText?.text || placePrediction.displayName?.text || ''
      const secondaryText = placePrediction.structuredFormat?.secondaryText?.text || placePrediction.formattedAddress || ''
      const description = placePrediction.displayName?.text || placePrediction.formattedAddress || `${mainText} ${secondaryText}`.trim()
      
      return {
        place_id: placePrediction.placeId,
        description: description,
        types: placePrediction.types || [],
        structured_formatting: {
          main_text: mainText,
          secondary_text: secondaryText
        }
      }
    }) || []

    console.log('Mapped predictions:', predictions.length, 'results')

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
