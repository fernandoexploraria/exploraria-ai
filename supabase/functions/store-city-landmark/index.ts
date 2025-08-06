import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { cityData } = await req.json()
    
    if (!cityData) {
      return new Response(
        JSON.stringify({ error: 'City data is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Creating synthetic landmark for city:', cityData.name)

    // Create synthetic landmark object
    const syntheticLandmark = {
      id: `city-${cityData.slug}`,
      name: cityData.name,
      coordinates: cityData.coordinates,
      place_id: `city-${cityData.slug}`,
      description: `Explore the vibrant city of ${cityData.name}`,
      photos: [],
      rating: 4.5,
      user_ratings_total: 1000,
      types: ['locality', 'political'],
      vicinity: cityData.name,
      geometry: {
        location: {
          lat: cityData.coordinates[1],
          lng: cityData.coordinates[0]
        }
      },
      city_slug: cityData.slug,
      created_at: new Date().toISOString(),
      landmark_type: 'synthetic_city'
    }

    // Store in interactions table as a special interaction type
    const { data, error } = await supabase
      .from('interactions')
      .insert({
        destination: cityData.name,
        user_input: `City landmark created for ${cityData.name}`,
        assistant_response: `Synthetic landmark object created for ${cityData.name}`,
        interaction_type: 'synthetic_city_landmark',
        landmark_coordinates: `(${cityData.coordinates[0]}, ${cityData.coordinates[1]})`,
        user_id: null, // Allow anonymous creation
        full_transcript: syntheticLandmark
      })
      .select()
      .single()

    if (error) {
      console.error('Error storing synthetic landmark:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to store landmark', details: error.message }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ Synthetic landmark stored successfully:', data.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        landmark: syntheticLandmark,
        interaction_id: data.id
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in store-city-landmark function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})