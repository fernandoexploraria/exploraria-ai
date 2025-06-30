
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { tourId } = await req.json();

    if (!tourId) {
      throw new Error('Tour ID is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Fetching tour details for tour ID:', tourId);

    // Fetch tour details from the database
    const { data: tourData, error: tourError } = await supabase
      .from('generated_tours')
      .select('destination, system_prompt')
      .eq('id', tourId)
      .single();

    if (tourError) {
      console.error('❌ Error fetching tour details:', tourError);
      throw new Error(`Failed to fetch tour details: ${tourError.message}`);
    }

    if (!tourData) {
      console.error('❌ Tour not found for ID:', tourId);
      throw new Error('Tour not found');
    }

    console.log('✅ Successfully fetched tour details:', {
      destination: tourData.destination,
      hasSystemPrompt: !!tourData.system_prompt
    });

    return new Response(
      JSON.stringify({
        destination: tourData.destination,
        systemPrompt: tourData.system_prompt
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Error in get-tour-details function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
