
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
    const { input, types = 'establishment|geocode' } = await req.json()
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

    console.log('Autocomplete search for:', input)

    // Use Google Places Autocomplete API
    const autocompleteUrl = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
    autocompleteUrl.searchParams.set('input', input)
    autocompleteUrl.searchParams.set('types', types)
    autocompleteUrl.searchParams.set('key', googleApiKey)
    
    const response = await fetch(autocompleteUrl.toString())
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google Places Autocomplete API error:', errorText)
      throw new Error(`Google Places API request failed: ${response.status}`)
    }

    const data = await response.json()
    console.log('Autocomplete response received:', data.predictions?.length || 0, 'predictions')

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error status:', data.status, data.error_message)
      throw new Error(`Google Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`)
    }

    return new Response(
      JSON.stringify({ 
        predictions: data.predictions || [],
        status: data.status 
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
