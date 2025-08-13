import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const { conversation_id, latitude, longitude, accuracy, user_id } = await req.json();
    
    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: 'conversation_id is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ error: 'latitude and longitude are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`[STORE-AGENT-LOCATION] Storing location for conversation: ${conversation_id}`);

    // Use service role key to bypass RLS for agent location storage
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Insert or update agent location
    const { data, error } = await supabase
      .from('agent_locations')
      .upsert({
        conversation_id,
        latitude,
        longitude,
        accuracy,
        user_id, // Optional for analytics
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'conversation_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing agent location:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to store location',
          details: error.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`[STORE-AGENT-LOCATION] Successfully stored location for conversation: ${conversation_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        conversation_id,
        location: {
          latitude,
          longitude,
          accuracy,
          updated_at: data.updated_at
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[STORE-AGENT-LOCATION] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to store agent location',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});