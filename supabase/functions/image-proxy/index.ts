import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    const url = new URL(req.url)
    const shortCode = url.pathname.split('/').pop()
    
    if (!shortCode) {
      return new Response('Short code required', { 
        status: 400,
        headers: corsHeaders 
      })
    }

    console.log('Looking up short code:', shortCode)

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Look up the original URL
    const { data: urlData, error } = await supabaseClient
      .from('shared_urls')
      .select('original_url, url_type')
      .eq('short_code', shortCode)
      .single()

    if (error || !urlData) {
      console.error('URL not found:', error)
      return new Response('URL not found', { 
        status: 404,
        headers: corsHeaders 
      })
    }

    console.log('Found original URL:', urlData.original_url)

    // Fetch the original image
    const response = await fetch(urlData.original_url)
    
    if (!response.ok) {
      console.error('Failed to fetch original image:', response.status)
      return new Response('Image not found', { 
        status: 404,
        headers: corsHeaders 
      })
    }

    // Get the image data
    const imageData = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    console.log('Serving image, content-type:', contentType)

    // Return the image with proper headers
    return new Response(imageData, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    })

  } catch (error) {
    console.error('Error in image-proxy:', error)
    return new Response('Internal server error', { 
      status: 500,
      headers: corsHeaders 
    })
  }
})
