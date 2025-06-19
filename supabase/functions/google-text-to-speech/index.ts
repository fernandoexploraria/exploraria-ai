
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    
    const googleAiApiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    if (!googleAiApiKey) {
      console.error('Google AI API key not found in environment')
      throw new Error('Google AI API key not configured')
    }

    console.log('Converting text to speech:', text.substring(0, 100) + '...')

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleAiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: 'en-US',
            name: 'en-US-Wavenet-D',
            ssmlGender: 'NEUTRAL'
          },
          audioConfig: {
            audioEncoding: 'MP3'
          }
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google TTS API error:', response.status, errorText)
      throw new Error(`Google TTS API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.audioContent) {
      console.error('No audio content in response:', data)
      throw new Error('No audio content received from Google TTS API')
    }

    console.log('Google TTS response received successfully')

    return new Response(
      JSON.stringify({ audioContent: data.audioContent }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error in google-text-to-speech function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
