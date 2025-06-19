
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
    const { audio } = await req.json()
    
    const googleAiApiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    if (!googleAiApiKey) {
      console.error('Google AI API key not found in environment')
      throw new Error('Google AI API key not configured')
    }

    console.log('Converting speech to text...')

    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${googleAiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 48000,
            languageCode: 'en-US',
          },
          audio: {
            content: audio
          }
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google Speech-to-Text API error:', response.status, errorText)
      throw new Error(`Google Speech-to-Text API error: ${response.status}`)
    }

    const data = await response.json()
    
    let text = ''
    if (data.results && data.results.length > 0 && data.results[0].alternatives) {
      text = data.results[0].alternatives[0].transcript
    }

    console.log('Google Speech-to-Text response:', text)

    return new Response(
      JSON.stringify({ text }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error in google-speech-to-text function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
