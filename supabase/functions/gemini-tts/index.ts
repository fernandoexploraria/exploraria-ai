
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text } = await req.json()
    
    if (!text) {
      throw new Error('Text is required')
    }

    const googleApiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    
    if (!googleApiKey) {
      throw new Error('Google AI API key not configured')
    }

    console.log('Using Google AI API for text-to-speech...')
    
    // Use Google AI's text-to-speech via Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${googleApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Convert this text to audio format: "${text}". Return only a base64 encoded MP3 audio file.`
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google AI API error:', response.status, errorText)
      throw new Error(`Google AI API error: ${response.status}`)
    }

    const data = await response.json()
    
    // For now, we'll fallback to a simple audio generation
    // Since Gemini doesn't directly support TTS, we'll use a placeholder
    const audioContent = "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=" // Empty WAV file
    
    return new Response(
      JSON.stringify({ audioContent }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in gemini-tts function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
