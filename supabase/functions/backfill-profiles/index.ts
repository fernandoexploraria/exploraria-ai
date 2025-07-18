import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    if (req.method === 'GET') {
      // Check for missing profiles
      const { data: authUsers, error: authError } = await supabaseClient.auth.admin.listUsers()
      
      if (authError) {
        console.error('Error fetching auth users:', authError)
        return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: profiles, error: profilesError } = await supabaseClient
        .from('profiles')
        .select('id')
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError)
        return new Response(JSON.stringify({ error: 'Failed to fetch profiles' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const profileIds = new Set(profiles.map(p => p.id))
      const missingProfiles = authUsers.users.filter(user => !profileIds.has(user.id))

      return new Response(JSON.stringify({ 
        totalUsers: authUsers.users.length,
        existingProfiles: profiles.length,
        missingProfiles: missingProfiles.length,
        missingUsers: missingProfiles.map(u => ({ id: u.id, email: u.email }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (req.method === 'POST') {
      // Create missing profiles
      const { data: authUsers, error: authError } = await supabaseClient.auth.admin.listUsers()
      
      if (authError) {
        console.error('Error fetching auth users:', authError)
        return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: profiles, error: profilesError } = await supabaseClient
        .from('profiles')
        .select('id')
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError)
        return new Response(JSON.stringify({ error: 'Failed to fetch profiles' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const profileIds = new Set(profiles.map(p => p.id))
      const missingProfiles = authUsers.users.filter(user => !profileIds.has(user.id))

      if (missingProfiles.length === 0) {
        return new Response(JSON.stringify({ 
          message: 'No missing profiles to create',
          created: 0 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Create missing profiles
      const profilesToCreate = missingProfiles.map(user => ({
        id: user.id,
        email: user.email || '',
        role: 'tourist' as const,
        full_name: user.user_metadata?.full_name || null,
      }))

      const { data: createdProfiles, error: createError } = await supabaseClient
        .from('profiles')
        .insert(profilesToCreate)
        .select()

      if (createError) {
        console.error('Error creating profiles:', createError)
        return new Response(JSON.stringify({ error: 'Failed to create profiles' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log(`Successfully created ${createdProfiles.length} profiles`)

      return new Response(JSON.stringify({ 
        message: 'Profiles created successfully',
        created: createdProfiles.length,
        profiles: createdProfiles
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})