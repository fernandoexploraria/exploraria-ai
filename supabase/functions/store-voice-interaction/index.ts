
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
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userInput, assistantResponse, and destination are required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header provided' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }
    
    console.log('Creating Supabase client...');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get current user with better error handling
    console.log('Getting user...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError) {
      console.error('Error getting user:', userError);
      
      // Check if it's a token expiration error
      if (userError.message?.includes('expired') || userError.message?.includes('invalid')) {
        return new Response(
          JSON.stringify({ error: 'Authentication token expired or invalid. Please refresh and try again.' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
          }
        )
      }
      
      return new Response(
        JSON.stringify({ error: `User authentication error: ${userError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }
    
    if (!user) {
      console.error('User not authenticated');
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }
    
    console.log('User authenticated:', user.id);

    // Generate embeddings using Gemini
    const geminiApiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    if (!geminiApiKey) {
      console.error('Gemini API key not configured');
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    console.log('Generating embeddings with Gemini...');
    
    // Generate embedding for user input
    const userInputEmbedding = await generateGeminiEmbedding(userInput, geminiApiKey)
    console.log('User input embedding generated, length:', userInputEmbedding.length);
    
    // Generate embedding for assistant response
    const assistantResponseEmbedding = await generateGeminiEmbedding(assistantResponse, geminiApiKey)
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
      
      // Handle specific database errors
      if (error.code === '42501') {
        return new Response(
          JSON.stringify({ error: 'Database permission error. Please check authentication.' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403 
          }
        )
      }
      
      return new Response(
        JSON.stringify({ error: `Database error: ${error.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
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
      JSON.stringify({ error: `Unexpected error: ${error.message}` }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
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
