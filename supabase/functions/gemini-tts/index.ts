
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

    console.log('Step 1: Enhancing text with Gemini AI...')
    
    // First, enhance the text with Gemini for better narration
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Please enhance this landmark description for audio narration. Make it sound like a friendly, knowledgeable tour guide speaking to visitors. Keep it conversational and under 30 seconds when spoken aloud. Original text: "${text}"`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 200
        }
      })
    })

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', geminiResponse.status, errorText)
      throw new Error(`Gemini API error: ${geminiResponse.status}`)
    }

    const geminiData = await geminiResponse.json()
    console.log('Step 2: Gemini enhancement complete')
    
    let enhancedText = text
    if (geminiData.candidates && geminiData.candidates[0] && geminiData.candidates[0].content) {
      enhancedText = geminiData.candidates[0].content.parts[0].text
    }

    console.log('Step 3: Converting enhanced text to speech...')

    // Now convert the enhanced text to speech using Google Cloud TTS
    const ttsResponse = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { text: enhancedText },
        voice: {
          languageCode: 'en-US',
          name: 'en-US-Neural2-F',
          ssmlGender: 'FEMALE'
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.9,
          pitch: 0.0,
          volumeGainDb: 0.0
        }
      })
    })

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text()
      console.error('Google TTS API error:', ttsResponse.status, errorText)
      
      // If TTS fails, return the enhanced text for browser fallback
      return new Response(
        JSON.stringify({ 
          enhancedText: enhancedText,
          originalText: text,
          audioContent: null,
          fallbackToBrowser: true
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const ttsData = await ttsResponse.json()
    console.log('Step 4: Audio generation complete')
    
    if (ttsData.audioContent) {
      return new Response(
        JSON.stringify({ 
          enhancedText: enhancedText,
          originalText: text,
          audioContent: ttsData.audioContent,
          fallbackToBrowser: false
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    } else {
      throw new Error('No audio content received from Google TTS')
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
