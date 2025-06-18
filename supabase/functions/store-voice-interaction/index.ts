
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Store voice interaction function called');
    
    const { userInput, assistantResponse, destination } = await req.json()
    console.log('Request body:', { userInput, assistantResponse, destination });

    if (!userInput || !assistantResponse || !destination) {
      console.error('Missing required fields');
      throw new Error('Missing required fields: userInput, assistantResponse, and destination are required');
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header');
      throw new Error('No authorization header provided');
    }
    
    console.log('Creating Supabase client...');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get current user
    console.log('Getting user...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError) {
      console.error('Error getting user:', userError);
      throw new Error(`User authentication error: ${userError.message}`);
    }
    
    if (!user) {
      console.error('User not authenticated');
      throw new Error('User not authenticated')
    }
    
    console.log('User authenticated:', user.id);

    // Generate embeddings using OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.error('OpenAI API key not configured');
      throw new Error('OpenAI API key not configured')
    }

    console.log('Generating embeddings...');
    
    // Generate embedding for user input
    const userInputEmbedding = await generateEmbedding(userInput, openaiApiKey)
    console.log('User input embedding generated, length:', userInputEmbedding.length);
    
    // Generate embedding for assistant response
    const assistantResponseEmbedding = await generateEmbedding(assistantResponse, openaiApiKey)
    console.log('Assistant response embedding generated, length:', assistantResponseEmbedding.length);

    // Store the interaction in the database
    console.log('Storing interaction in database...');
    const { data, error } = await supabaseClient
      .from('voice_interactions')
      .insert({
        user_id: user.id,
        destination,
        user_input: userInput,
        assistant_response: assistantResponse,
        user_input_embedding: userInputEmbedding,
        assistant_response_embedding: assistantResponseEmbedding
      })

    if (error) {
      console.error('Database error:', error)
      throw error
    }

    console.log('Interaction stored successfully:', data);

    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error storing voice interaction:', error)
    return new Response(
      JSON.stringify({ error: error.message, details: error }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  console.log('Generating embedding for text length:', text.length);
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-ada-002'
    }),
  })

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', response.status, errorText);
    throw new Error(`Failed to generate embedding: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  console.log('Embedding generated successfully');
  return data.data[0].embedding
}
