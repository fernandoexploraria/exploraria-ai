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
    const { action, agentConfig, agentId } = await req.json()
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY')
    
    if (!elevenLabsApiKey) {
      throw new Error('ElevenLabs API key not configured')
    }

    switch (action) {
      case 'create':
        return await createAgent(agentConfig, elevenLabsApiKey)
      case 'update':
        return await updateAgent(agentId, agentConfig, elevenLabsApiKey)
      case 'delete':
        return await deleteAgent(agentId, elevenLabsApiKey)
      default:
        throw new Error('Invalid action specified')
    }

  } catch (error) {
    console.error('Error in elevenlabs-agent-management:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function createAgent(config: any, apiKey: string) {
  const agentData = {
    name: config.name,
    conversation_config: {
      agent: {
        prompt: {
          prompt: config.system_prompt
        },
        first_message: "Hello! I'm your AI tour guide. I'm excited to help you explore this amazing destination. What would you like to know about our tour today?",
        language: "en"
      },
      asr: {
        quality: "high",
        user_input_audio_format: "pcm_16000"
      },
      tts: {
        model_id: "eleven_multilingual_v2",
        voice_id: config.voice_id,
        optimize_streaming_latency: 3,
        output_format: "pcm_16000"
      },
      llm: {
        model: "gpt-4o-mini",
        max_tokens: 500,
        temperature: 0.7
      }
    },
    platform_settings: {
      widget_config: {
        width: 300,
        height: 400
      }
    }
  }

  const response = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(agentData)
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('ElevenLabs API error:', errorText)
    throw new Error(`Failed to create agent: ${response.status} ${errorText}`)
  }

  const result = await response.json()
  
  return new Response(
    JSON.stringify({ 
      agent_id: result.agent_id,
      agent_url: result.agent_url,
      success: true 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function updateAgent(agentId: string, config: any, apiKey: string) {
  const updateData = {
    conversation_config: {
      agent: {
        prompt: {
          prompt: config.system_prompt
        },
        language: "en"
      },
      tts: {
        voice_id: config.voice_id
      }
    }
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
    method: 'PATCH',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateData)
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('ElevenLabs API error:', errorText)
    throw new Error(`Failed to update agent: ${response.status} ${errorText}`)
  }

  const result = await response.json()
  
  return new Response(
    JSON.stringify({ 
      agent_id: result.agent_id,
      success: true 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function deleteAgent(agentId: string, apiKey: string) {
  const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
    method: 'DELETE',
    headers: {
      'xi-api-key': apiKey,
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('ElevenLabs API error:', errorText)
    throw new Error(`Failed to delete agent: ${response.status} ${errorText}`)
  }
  
  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}