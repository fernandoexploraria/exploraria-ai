
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
    const { input, types = ['establishment', 'geocode'] } = await req.json()
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

    console.log('Autocomplete search for:', input, 'with types:', types)

    // Use new Google Places API v1 autocomplete endpoint
    const autocompleteUrl = 'https://places.googleapis.com/v1/places:autocomplete'
    
    const response = await fetch(autocompleteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.place,suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types'
      },
      body: JSON.stringify({
        input: input,
        includedPrimaryTypes: Array.isArray(types) ? types : [types],
        languageCode: 'en'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google Places Autocomplete API error:', errorText)
      throw new Error(`Google Places API request failed: ${response.status}`)
    }

    const data = await response.json()
    console.log('Autocomplete response received:', data.suggestions?.length || 0, 'suggestions')

    // Map new API response to legacy format expected by the component
    const predictions = data.suggestions?.map((suggestion: any) => {
      const prediction = suggestion.placePrediction
      return {
        place_id: prediction.placeId,
        description: prediction.text?.text || prediction.text,
        types: prediction.types || [],
        structured_formatting: prediction.structuredFormat ? {
          main_text: prediction.structuredFormat.mainText?.text || prediction.structuredFormat.mainText,
          secondary_text: prediction.structuredFormat.secondaryText?.text || prediction.structuredFormat.secondaryText
        } : undefined
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
