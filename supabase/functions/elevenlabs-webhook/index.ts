
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('ElevenLabs webhook received');
    
    const webhookData = await req.json()
    console.log('Webhook payload:', JSON.stringify(webhookData, null, 2));

    // Initialize Supabase client with service role key for webhook access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Extract relevant data from webhook payload
    const {
      conversation_id,
      transcript,
      duration_seconds,
      audio_url,
      agent_id,
      variables // This contains custom variables like destination, user_id
    } = webhookData

    if (!conversation_id || !transcript) {
      console.error('Missing required webhook data');
      return new Response(
        JSON.stringify({ error: 'Missing conversation_id or transcript' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract user_id and destination from variables
    const userId = variables?.user_id
    const destination = variables?.destination || 'Unknown'

    if (!userId) {
      console.error('No user_id in webhook variables');
      return new Response(
        JSON.stringify({ error: 'Missing user_id in variables' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process the transcript to extract user input and assistant responses
    let userInput = ''
    let assistantResponse = ''

    // Parse transcript array to separate user and assistant messages
    if (Array.isArray(transcript)) {
      const userMessages = []
      const assistantMessages = []

      transcript.forEach(entry => {
        if (entry.role === 'user' && entry.content) {
          userMessages.push(entry.content)
        } else if (entry.role === 'assistant' && entry.content) {
          assistantMessages.push(entry.content)
        }
      })

      userInput = userMessages.join(' ')
      assistantResponse = assistantMessages.join(' ')
    }

    // Skip if no meaningful content
    if (!userInput.trim() || !assistantResponse.trim()) {
      console.log('No meaningful conversation content, skipping storage');
      return new Response(
        JSON.stringify({ message: 'No meaningful content to store' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate embeddings using Gemini
    const geminiApiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    if (!geminiApiKey) {
      console.error('Gemini API key not configured');
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Generating embeddings...');
    
    // Generate embedding for user input
    const userInputEmbedding = await generateGeminiEmbedding(userInput, geminiApiKey)
    
    // Generate embedding for assistant response
    const assistantResponseEmbedding = await generateGeminiEmbedding(assistantResponse, geminiApiKey)

    // Store the conversation in the database
    console.log('Storing conversation in database...');
    const { data, error } = await supabaseClient
      .from('voice_interactions')
      .insert({
        user_id: userId,
        destination: destination,
        user_input: userInput,
        assistant_response: assistantResponse,
        conversation_id: conversation_id,
        conversation_duration: duration_seconds,
        audio_url: audio_url,
        agent_id: agent_id,
        full_transcript: transcript,
        user_input_embedding: userInputEmbedding,
        assistant_response_embedding: assistantResponseEmbedding
      })

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: `Database error: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Conversation stored successfully:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Conversation processed and stored successfully',
        conversation_id: conversation_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: `Webhook processing error: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function generateGeminiEmbedding(text: string, apiKey: string): Promise<number[]> {
  console.log('Generating Gemini embedding for text length:', text.length);
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'models/text-embedding-004',
      content: {
        parts: [{ text: text }]
      }
    }),
  })

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);
    throw new Error(`Failed to generate embedding: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  console.log('Gemini embedding generated successfully');
  return data.embedding.values
}
