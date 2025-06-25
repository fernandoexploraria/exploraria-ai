
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EnhancedStreetViewRequest {
  coordinates: [number, number]; // [lng, lat]
  landmarkName: string;
  viewpoints?: 'single' | 'cardinal' | 'smart' | 'all';
  quality?: 'low' | 'medium' | 'high';
  landmarkType?: string;
  size?: string;
}

interface StreetViewData {
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

interface MultiViewpointResponse {
  primary: StreetViewData;
  viewpoints: StreetViewData[];
  metadata: {
    totalViews: number;
    recommendedView: number;
    dataUsage: string;
  };
}

// Smart heading calculation based on landmark type and surroundings
const getSmartHeadings = (landmarkType: string = 'building'): number[] => {
  switch (landmarkType.toLowerCase()) {
    case 'monument':
    case 'statue':
      // For monuments, focus on front-facing and diagonal views
      return [0, 45, 135, 225];
    case 'building':
    case 'architecture':
      // For buildings, show all cardinal directions
      return [0, 90, 180, 270];
    case 'natural':
    case 'park':
      // For natural landmarks, focus on scenic angles
      return [30, 120, 210, 300];
    case 'bridge':
      // For bridges, show approaches and side views
      return [0, 90, 180, 270];
    default:
      // Default cardinal directions
      return [0, 90, 180, 270];
  }
};

const getViewpointHeadings = (strategy: string, landmarkType: string = 'building'): number[] => {
  const smartHeadings = getSmartHeadings(landmarkType);
  
  switch (strategy) {
    case 'single':
      return [0]; // North-facing only
    case 'cardinal':
      return [0, 90, 180, 270]; // N, E, S, W
    case 'smart':
      return smartHeadings.slice(0, 3); // First 3 smart angles
    case 'all':
      return smartHeadings; // All smart angles
    default:
      return [0];
  }
};

const getSizeForQuality = (quality: string): string => {
  switch (quality) {
    case 'low':
      return '400x400';
    case 'medium':
      return '600x600';
    case 'high':
      return '800x800';
    default:
      return '640x640';
  }
};

const fetchStreetViewForHeading = async (
  lat: number,
  lng: number,
  heading: number,
  landmarkName: string,
  size: string,
  googleApiKey: string
): Promise<StreetViewData | null> => {
  const pitch = 0;
  const fov = 90;

  // Check availability first
  const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?` +
    `location=${lat},${lng}&` +
    `heading=${heading}&` +
    `key=${googleApiKey}`;

  try {
    const metadataResponse = await fetch(metadataUrl);
    const metadata = await metadataResponse.json();

    if (metadata.status !== 'OK') {
      return null;
    }

    // Build the Street View Static API URL
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?` +
      `location=${lat},${lng}&` +
      `size=${size}&` +
      `heading=${heading}&` +
      `pitch=${pitch}&` +
      `fov=${fov}&` +
      `key=${googleApiKey}`;

    return {
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
  } catch (error) {
    console.error(`❌ Error fetching Street View for heading ${heading}:`, error);
    return null;
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      });
    }

    const { 
      coordinates, 
      landmarkName, 
      viewpoints = 'single',
      quality = 'medium',
      landmarkType = 'building',
      size
    }: EnhancedStreetViewRequest = await req.json();
    
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

    const finalSize = size || getSizeForQuality(quality);
    const headings = getViewpointHeadings(viewpoints, landmarkType);
    
    console.log(`🗺️ Fetching Enhanced Street View for ${landmarkName} at [${lng}, ${lat}]`);
    console.log(`📐 Strategy: ${viewpoints}, Quality: ${quality}, Headings: [${headings.join(', ')}°]`);

    // Fetch all viewpoints concurrently
    const viewpointPromises = headings.map(heading => 
      fetchStreetViewForHeading(lat, lng, heading, landmarkName, finalSize, googleApiKey)
    );

    const allViewpoints = await Promise.all(viewpointPromises);
    const validViewpoints = allViewpoints.filter(vp => vp !== null) as StreetViewData[];

    if (validViewpoints.length === 0) {
      console.log(`❌ No Street View available for ${landmarkName} from any angle`);
      return new Response(JSON.stringify({
        error: 'Street View not available at this location from any angle',
        landmarkName
      }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Primary view is the first valid viewpoint (usually north-facing)
    const primary = validViewpoints[0];
    
    // Calculate data usage estimate
    const imageSize = finalSize.split('x').map(Number);
    const estimatedKbPerImage = (imageSize[0] * imageSize[1] * 0.8) / 1024; // Rough JPEG estimate
    const totalDataKb = Math.round(estimatedKbPerImage * validViewpoints.length);
    
    console.log(`✅ Enhanced Street View available for ${landmarkName}: ${validViewpoints.length} viewpoints (${totalDataKb}KB total)`);

    const response: MultiViewpointResponse = {
      primary,
      viewpoints: validViewpoints,
      metadata: {
        totalViews: validViewpoints.length,
        recommendedView: 0, // Index of the primary view
        dataUsage: `${totalDataKb}KB (${validViewpoints.length} views)`
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in google-streetview-enhanced function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
