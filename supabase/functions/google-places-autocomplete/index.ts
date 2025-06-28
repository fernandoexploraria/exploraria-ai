
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

    // Use Google Places API v1 autocomplete endpoint - minimal approach first
    const autocompleteUrl = 'https://places.googleapis.com/v1/places:autocomplete'
    
    // Build minimal request body to test basic functionality
    const requestBody: any = {
      input: input,
      languageCode: 'en'
    }

    // Only add types if we have a simple array (avoid complex includedPrimaryTypes for now)
    if (Array.isArray(types) && types.length > 0) {
      requestBody.includedPrimaryTypes = types
    }

    // Add session token if provided
    if (sessionToken) {
      requestBody.sessionToken = sessionToken
    }

    console.log('🔍 Request body:', JSON.stringify(requestBody, null, 2))

    const response = await fetch(autocompleteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        // Start with minimal field mask - just get everything for now to see structure
        'X-Goog-FieldMask': '*'
      },
      body: JSON.stringify(requestBody)
    })

    console.log('🔍 Response status:', response.status)
    console.log('🔍 Response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.error('🔍 Google Places Autocomplete API error:', errorText)
      throw new Error(`Google Places API request failed: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('🔍 Raw API response structure:', JSON.stringify(data, null, 2))
    console.log('🔍 Autocomplete response received:', data.suggestions?.length || data.predictions?.length || 0, 'results')

    // Handle both possible response structures
    let suggestions = data.suggestions || data.predictions || []
    
    // Map API response to format expected by the component
    const predictions = suggestions.map((item: any) => {
      // Handle both suggestion.placePrediction and direct prediction structures
      const prediction = item.placePrediction || item
      
      console.log('🔍 Processing prediction:', JSON.stringify(prediction, null, 2))
      
      // Extract fields safely with multiple fallbacks
      const placeId = prediction.placeId || prediction.place_id
      let mainText = ''
      let secondaryText = ''
      let description = ''
      
      // Try different field structures
      if (prediction.displayName?.text) {
        description = prediction.displayName.text
        mainText = prediction.displayName.text
      } else if (prediction.text?.text) {
        description = prediction.text.text
        mainText = prediction.text.text
      } else if (prediction.description) {
        description = prediction.description
        mainText = prediction.description
      }
      
      // Try to get structured format
      if (prediction.structuredFormat) {
        mainText = prediction.structuredFormat.mainText?.text || mainText
        secondaryText = prediction.structuredFormat.secondaryText?.text || ''
      } else if (prediction.structuredFormatting) {
        mainText = prediction.structuredFormatting.main_text || mainText
        secondaryText = prediction.structuredFormatting.secondary_text || ''
      }
      
      // Get formatted address
      const formattedAddress = prediction.formattedAddress || prediction.formatted_address || secondaryText
      
      // Use description if we don't have mainText
      if (!description && mainText) {
        description = secondaryText ? `${mainText}, ${secondaryText}` : mainText
      }
      
      const result = {
        place_id: placeId,
        description: description || 'Unknown place',
        types: prediction.types || [],
        structured_formatting: {
          main_text: mainText || 'Unknown place',
          secondary_text: secondaryText || formattedAddress || ''
        }
      }
      
      console.log('🔍 Mapped result:', JSON.stringify(result, null, 2))
      return result
    })

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
