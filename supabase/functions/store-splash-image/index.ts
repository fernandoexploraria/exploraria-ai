
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Download the image from Unsplash
    const imageUrl = 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80'
    
    console.log('Downloading image from:', imageUrl)
    
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`)
    }

    const imageBuffer = await response.arrayBuffer()
    const imageFile = new File([imageBuffer], 'splash-bg.jpg', { type: 'image/jpeg' })

    console.log('Image downloaded, size:', imageBuffer.byteLength, 'bytes')

    // Upload to Supabase Storage
    const { data, error } = await supabaseClient.storage
      .from('static-assets')
      .upload('splash-bg.jpg', imageFile, {
        cacheControl: '31536000', // Cache for 1 year
        upsert: true // Replace if exists
      })

    if (error) {
      console.error('Upload error:', error)
      throw error
    }

    console.log('Image uploaded successfully:', data)

    // Get the public URL
    const { data: urlData } = supabaseClient.storage
      .from('static-assets')
      .getPublicUrl('splash-bg.jpg')

    return new Response(JSON.stringify({
      success: true,
      message: 'Image stored successfully',
      url: urlData.publicUrl,
      path: data.path
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error storing splash image:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
