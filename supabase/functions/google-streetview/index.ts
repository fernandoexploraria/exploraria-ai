
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface StreetViewRequest {
  coordinates: [number, number]; // [lng, lat]
  landmarkName: string;
  size?: string;
  fov?: number;
  pitch?: number;
}

interface StreetViewResponse {
  imageUrl: string;
  heading: number;
  pitch: number;
  fov: number;
  location: {
    lat: number;
    lng: number;
  };
  landmarkName: string;
  metadata: {
    status: string;
    copyright?: string;
  };
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
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      });
    }

    const { coordinates, landmarkName, size = "640x640", fov = 90, pitch = 0 }: StreetViewRequest = await req.json();
    
    if (!coordinates || coordinates.length !== 2) {
      return new Response('Invalid coordinates provided', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const [lng, lat] = coordinates;
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    
    if (!googleApiKey) {
      console.error('GOOGLE_API_KEY not found in environment variables');
      return new Response('Google API key not configured', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    console.log(`🗺️ Fetching Street View for ${landmarkName} at [${lng}, ${lat}]`);

    // Calculate optimal heading (direction to face the landmark)
    // For now, we'll use a default heading of 0 (north) and let Street View find the best view
    const heading = 0;

    // First, check if Street View is available at this location
    const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?` +
      `location=${lat},${lng}&` +
      `key=${googleApiKey}`;

    console.log('🔍 Checking Street View availability...');
    const metadataResponse = await fetch(metadataUrl);
    const metadata = await metadataResponse.json();

    if (metadata.status !== 'OK') {
      console.log(`❌ Street View not available for ${landmarkName}: ${metadata.status}`);
      return new Response(JSON.stringify({
        error: 'Street View not available at this location',
        status: metadata.status,
        landmarkName
      }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Build the Street View Static API URL
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?` +
      `location=${lat},${lng}&` +
      `size=${size}&` +
      `heading=${heading}&` +
      `pitch=${pitch}&` +
      `fov=${fov}&` +
      `key=${googleApiKey}`;

    console.log(`✅ Street View available for ${landmarkName}`);

    const response: StreetViewResponse = {
      imageUrl: streetViewUrl,
      heading,
      pitch,
      fov,
      location: {
        lat: metadata.location?.lat || lat,
        lng: metadata.location?.lng || lng
      },
      landmarkName,
      metadata: {
        status: metadata.status,
        copyright: metadata.copyright
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in google-streetview function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
