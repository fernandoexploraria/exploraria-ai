
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
    
    // Use the correct model name for Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Please provide a natural, conversational audio description for: "${text}". Make it sound like a friendly tour guide speaking to visitors. Keep it under 30 seconds when spoken aloud.`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 200
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google AI API error:', response.status, errorText)
      throw new Error(`Google AI API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('Gemini API response received for TTS')
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const generatedText = data.candidates[0].content.parts[0].text
      
      // Since Gemini doesn't provide actual audio, we'll return the enhanced text
      // The frontend will use browser TTS with this enhanced description
      return new Response(
        JSON.stringify({ 
          enhancedText: generatedText,
          originalText: text 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    } else {
      throw new Error('No valid response from Gemini API')
    }
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
