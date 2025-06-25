import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function generateShortCode(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    const { originalUrl, urlType, interactionId } = await req.json()
    
    console.log('Creating short URL for:', { originalUrl, urlType, interactionId })

    if (!originalUrl || !urlType) {
      return new Response(
        JSON.stringify({ error: 'originalUrl and urlType are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Check if a short URL already exists for this original URL and interaction
    const { data: existing } = await supabaseClient
      .from('shared_urls')
      .select('short_code')
      .eq('original_url', originalUrl)
      .eq('interaction_id', interactionId)
      .single()

    if (existing) {
      console.log('Returning existing short code:', existing.short_code)
      const shortUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/image-proxy/${existing.short_code}`
      return new Response(
        JSON.stringify({ shortUrl, shortCode: existing.short_code }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Generate a new short code
    let shortCode = generateShortCode()
    let attempts = 0
    const maxAttempts = 10

    // Ensure uniqueness
    while (attempts < maxAttempts) {
      const { data: existingCode } = await supabaseClient
        .from('shared_urls')
        .select('id')
        .eq('short_code', shortCode)
        .single()

      if (!existingCode) {
        break // Code is unique
      }
      
      shortCode = generateShortCode()
      attempts++
    }

    if (attempts === maxAttempts) {
      throw new Error('Failed to generate unique short code')
    }

    // Insert the new short URL
    const { data, error } = await supabaseClient
      .from('shared_urls')
      .insert({
        short_code: shortCode,
        original_url: originalUrl,
        url_type: urlType,
        interaction_id: interactionId
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting short URL:', error)
      throw error
    }

    console.log('Created short URL:', data)

    const shortUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/image-proxy/${shortCode}`

    return new Response(
      JSON.stringify({ shortUrl, shortCode }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error creating short URL:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
