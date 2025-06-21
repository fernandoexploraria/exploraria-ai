

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
    console.log('Search function called');
    const { query, destination } = await req.json()
    console.log('Search query:', query, 'Destination filter:', destination);
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated:', user.id);

    // Generate embedding for the search query using Gemini
    const geminiApiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    if (!geminiApiKey) {
      console.error('Gemini API key not configured');
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Generating embedding for query...');
    
    const embeddingResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: {
          parts: [{ text: query }]
        }
      })
    })

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error('Gemini API error:', embeddingResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate embedding' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const embeddingData = await embeddingResponse.json()
    const queryEmbedding = embeddingData.embedding.values
    console.log('Generated embedding with dimensions:', queryEmbedding.length);

    // Use the search function with standard threshold for production
    console.log('Calling search function...');
    const { data: searchResults, error: searchError } = await supabaseClient
      .rpc('search_interactions', {
        query_embedding: queryEmbedding,
        match_threshold: 0.5, // Standard threshold balancing precision and recall
        match_count: 20,
        user_id: user.id
      })

    if (searchError) {
      console.error('Search error:', searchError)
      return new Response(
        JSON.stringify({ error: 'Search failed: ' + searchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Search results count:', searchResults?.length || 0);

    // Apply destination filter on the client side if needed
    let filteredResults = searchResults || []
    if (destination && destination !== '') {
      filteredResults = filteredResults.filter(result => 
        result.destination && result.destination.toLowerCase().includes(destination.toLowerCase())
      )
      console.log('Filtered results count:', filteredResults.length);
    }

    return new Response(
      JSON.stringify({ results: filteredResults }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

