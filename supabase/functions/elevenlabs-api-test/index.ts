import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    // Create Supabase client with service role key to verify user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: user, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const reqBody = await req.json();
    const { action } = reqBody;

    if (action === 'test_connection') {
      const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
      
      if (!apiKey) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'ELEVENLABS_API_KEY not configured' 
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Test the API key by making a simple request to get user info
      const response = await fetch('https://api.elevenlabs.io/v1/user', {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const userData = await response.json();
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'API connection successful',
            user_info: {
              subscription: userData.subscription,
              character_count: userData.character_count,
              character_limit: userData.character_limit
            }
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } else {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `API request failed: ${response.status} ${errorText}` 
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    if (action === 'list_voices') {
      const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
      
      if (!apiKey) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'ELEVENLABS_API_KEY not configured' 
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Fetch the voices from ElevenLabs API
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const voicesData = await response.json();
        return new Response(
          JSON.stringify({ 
            success: true, 
            voices: voicesData.voices || []
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } else {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to fetch voices: ${response.status} ${errorText}` 
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    if (action === 'search_voices') {
      const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
      
      if (!apiKey) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'ELEVENLABS_API_KEY not configured' 
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const { filters, searchTerm } = reqBody;
      
      // Get all voices first
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        let voices = data.voices || [];

        // Apply server-side filtering
        if (filters) {
          voices = voices.filter(voice => {
            // Check gender filter
            if (filters.gender && voice.labels?.gender !== filters.gender) {
              return false;
            }
            
            // Check age filter
            if (filters.age && voice.labels?.age !== filters.age) {
              return false;
            }
            
            // Check accent filter
            if (filters.accent && voice.labels?.accent !== filters.accent) {
              return false;
            }
            
            // Check category filter
            if (filters.category && voice.category !== filters.category) {
              return false;
            }
            
            // Check language filter
            if (filters.language && voice.labels?.language !== filters.language) {
              return false;
            }
            
            return true;
          });
        }

        // Apply search term filtering
        if (searchTerm && searchTerm.trim()) {
          const lowerSearchTerm = searchTerm.toLowerCase();
          voices = voices.filter(voice => {
            return (
              voice.name?.toLowerCase().includes(lowerSearchTerm) ||
              voice.description?.toLowerCase().includes(lowerSearchTerm) ||
              voice.labels?.descriptive?.toLowerCase().includes(lowerSearchTerm) ||
              voice.labels?.use_case?.toLowerCase().includes(lowerSearchTerm)
            );
          });
        }

        // Limit to 100 results as requested
        voices = voices.slice(0, 100);
        
        return new Response(
          JSON.stringify({
            success: true,
            voices: voices
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } else {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to search voices: ${response.status} ${errorText}` 
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in elevenlabs-api-test:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});