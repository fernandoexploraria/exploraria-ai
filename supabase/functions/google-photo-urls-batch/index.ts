import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');

interface PhotoReference {
  photoReference: string;
  placeId: string;
  sizes: Array<{ name: 'thumb' | 'medium' | 'large', maxWidth: number }>;
}

interface BatchPhotoUrlRequest {
  photoReferences: PhotoReference[];
}

interface PhotoUrls {
  thumb: string;
  medium: string;
  large: string;
}

interface BatchPhotoUrlResponse {
  success: boolean;
  photos: Record<string, PhotoUrls>;
  errors?: Record<string, string>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GOOGLE_API_KEY) {
      throw new Error('Google API key not configured');
    }

    const { photoReferences }: BatchPhotoUrlRequest = await req.json();
    
    if (!photoReferences || !Array.isArray(photoReferences)) {
      throw new Error('Invalid photoReferences array');
    }

    console.log(`🔧 [Batch Function] Processing ${photoReferences.length} photo references`);
    
    const photos: Record<string, PhotoUrls> = {};
    const errors: Record<string, string> = {};
    
    // Process all photos in parallel
    const photoPromises = photoReferences.map(async ({ photoReference, placeId, sizes }) => {
      try {
        console.log(`🔧 [Batch Function] Processing photo: ${photoReference} for place: ${placeId}`);
        
        // Use the photoReference directly as it already contains the full resource name
        // Format: places/{placeId}/photos/{photoReference}
        const fullResourceName = photoReference;
        
        // Process all sizes for this photo in parallel
        const sizePromises = sizes.map(async ({ name, maxWidth }) => {
          const url = `https://places.googleapis.com/v1/${fullResourceName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_API_KEY}`;
          return { name, url };
        });
        
        const sizeResults = await Promise.all(sizePromises);
        
        // Build URLs object for this photo
        const photoUrls: Partial<PhotoUrls> = {};
        sizeResults.forEach(({ name, url }) => {
          photoUrls[name] = url;
        });
        
        photos[photoReference] = photoUrls as PhotoUrls;
        console.log(`✅ [Batch Function] Successfully processed: ${photoReference}`);
        
      } catch (error) {
        console.error(`❌ [Batch Function] Failed to process photo ${photoReference}:`, error);
        errors[photoReference] = error instanceof Error ? error.message : 'Unknown error';
      }
    });
    
    // Wait for all photos to be processed
    await Promise.allSettled(photoPromises);
    
    const successCount = Object.keys(photos).length;
    const errorCount = Object.keys(errors).length;
    
    console.log(`✅ [Batch Function] Processing complete: ${successCount} success, ${errorCount} errors`);
    
    const response: BatchPhotoUrlResponse = {
      success: successCount > 0,
      photos,
      ...(errorCount > 0 && { errors })
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ [Batch Function] Batch photo URL construction error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      photos: {}
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});