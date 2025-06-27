
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destination, destinationDetails } = await req.json();
    
    console.log('🏪 Storing tour destination:', { destination, destinationDetails });

    if (!destination || !destinationDetails) {
      throw new Error('Destination and destination details are required');
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get user from JWT token
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      throw new Error('Invalid or expired token');
    }

    console.log('👤 User authenticated:', user.id);

    // Store the tour destination in the generated_tours table
    const tourData = {
      user_id: user.id,
      destination: destination,
      destination_details: destinationDetails,
      system_prompt: 'Simple tour destination storage - no generation performed',
      total_landmarks: 0,
      generation_start_time: new Date().toISOString(),
      generation_end_time: new Date().toISOString(),
      total_processing_time_ms: 0
    };

    const { data: tourRecord, error: insertError } = await supabase
      .from('generated_tours')
      .insert(tourData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error inserting tour record:', insertError);
      throw new Error(`Failed to store tour destination: ${insertError.message}`);
    }

    console.log('✅ Tour destination stored successfully:', tourRecord.id);

    return new Response(JSON.stringify({ 
      success: true,
      tourId: tourRecord.id,
      destination: destination,
      destinationDetails: destinationDetails,
      message: 'Tour destination stored successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in store-tour-destination function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
