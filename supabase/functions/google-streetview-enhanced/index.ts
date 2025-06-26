
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    strategy?: string;
    quality?: string;
    landmarkType?: string;
    imageSize?: string;
    loadingTime?: number;
    networkOptimized?: boolean;
    availableHeadings?: number[];
    coverage?: string;
    fallbackInfo?: {
      requestedHeadings: number[];
      successfulHeadings: number[];
      fallbacksUsed: number;
      coveragePercent: number;
    };
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

// Generate fallback headings around a target heading
const generateFallbackHeadings = (targetHeading: number, toleranceSteps: number[] = [10, 20, 30, 45]): number[] => {
  const fallbacks = [];
  
  for (const tolerance of toleranceSteps) {
    // Try both directions around the target
    const positive = (targetHeading + tolerance) % 360;
    const negative = (targetHeading - tolerance + 360) % 360;
    
    fallbacks.push(positive, negative);
  }
  
  return fallbacks;
};

// Enhanced function with fallback strategy
const fetchStreetViewWithFallback = async (
  lat: number,
  lng: number,
  targetHeading: number,
  landmarkName: string,
  size: string,
  googleApiKey: string,
  attemptedHeadings: Set<number> = new Set()
): Promise<{ data: StreetViewData | null; actualHeading: number; fallbackUsed: boolean }> => {
  const pitch = 0;
  const fov = 90;

  // Try the target heading first
  const headingsToTry = [targetHeading, ...generateFallbackHeadings(targetHeading)];
  
  for (const heading of headingsToTry) {
    // Skip if we've already tried this heading
    if (attemptedHeadings.has(heading)) continue;
    
    attemptedHeadings.add(heading);
    
    // Check availability first
    const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?` +
      `location=${lat},${lng}&` +
      `heading=${heading}&` +
      `key=${googleApiKey}`;

    try {
      const metadataResponse = await fetch(metadataUrl);
      const metadata = await metadataResponse.json();

      if (metadata.status !== 'OK') {
        console.log(`❌ Heading ${heading}° unavailable (status: ${metadata.status})`);
        continue;
      }

      // Build the Street View Static API URL
      const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?` +
        `location=${lat},${lng}&` +
        `size=${size}&` +
        `heading=${heading}&` +
        `pitch=${pitch}&` +
        `fov=${fov}&` +
        `key=${googleApiKey}`;

      const streetViewData: StreetViewData = {
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

      const fallbackUsed = heading !== targetHeading;
      if (fallbackUsed) {
        console.log(`✅ Fallback successful: ${targetHeading}° → ${heading}° for ${landmarkName}`);
      } else {
        console.log(`✅ Direct hit: ${heading}° for ${landmarkName}`);
      }

      return { data: streetViewData, actualHeading: heading, fallbackUsed };
    } catch (error) {
      console.error(`❌ Error testing heading ${heading}°:`, error);
      continue;
    }
  }

  console.log(`❌ No Street View available around ${targetHeading}° for ${landmarkName}`);
  return { data: null, actualHeading: targetHeading, fallbackUsed: false };
};

// Ensure minimum spacing between viewpoints
const filterByMinimumSpacing = (viewpoints: StreetViewData[], minSpacing: number = 30): StreetViewData[] => {
  if (viewpoints.length <= 1) return viewpoints;
  
  const filtered = [viewpoints[0]]; // Always include the first viewpoint
  
  for (let i = 1; i < viewpoints.length; i++) {
    const currentHeading = viewpoints[i].heading;
    let hasMinSpacing = true;
    
    for (const existing of filtered) {
      const angleDiff = Math.abs(currentHeading - existing.heading);
      const minDiff = Math.min(angleDiff, 360 - angleDiff); // Handle wrap-around
      
      if (minDiff < minSpacing) {
        hasMinSpacing = false;
        break;
      }
    }
    
    if (hasMinSpacing) {
      filtered.push(viewpoints[i]);
    }
  }
  
  console.log(`📐 Filtered viewpoints: ${viewpoints.length} → ${filtered.length} (min spacing: ${minSpacing}°)`);
  return filtered;
};

// Try alternative strategies if initial strategy yields too few viewpoints
const tryAlternativeHeadings = (
  originalHeadings: number[],
  successfulHeadings: number[],
  strategy: string
): number[] => {
  if (successfulHeadings.length >= 2) return []; // We have enough viewpoints
  
  const alternatives = [];
  
  // If we only got 1 viewpoint, try intermediate directions
  if (successfulHeadings.length === 1) {
    const baseHeading = successfulHeadings[0];
    
    // Try 90° increments from the successful heading
    for (let offset of [90, 180, 270]) {
      const newHeading = (baseHeading + offset) % 360;
      if (!originalHeadings.includes(newHeading)) {
        alternatives.push(newHeading);
      }
    }
    
    // Also try 45° increments for more options
    for (let offset of [45, 135, 225, 315]) {
      const newHeading = (baseHeading + offset) % 360;
      if (!originalHeadings.includes(newHeading) && !alternatives.includes(newHeading)) {
        alternatives.push(newHeading);
      }
    }
  }
  
  console.log(`🔄 Trying alternative headings for ${strategy} strategy:`, alternatives);
  return alternatives.slice(0, 3); // Limit to 3 additional attempts
};

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

    const { 
      coordinates, 
      landmarkName, 
      viewpoints = 'single',
      quality = 'medium',
      landmarkType = 'building',
      size,
      includeMetadata = true
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
    const requestedHeadings = getViewpointHeadings(viewpoints, landmarkType);
    
    console.log(`🗺️ Fetching Enhanced Street View for ${landmarkName} at [${lng}, ${lat}]`);
    console.log(`📐 Strategy: ${viewpoints}, Quality: ${quality}, Requested: [${requestedHeadings.join(', ')}°]`);

    const attemptedHeadings = new Set<number>();
    const successfulViewpoints: StreetViewData[] = [];
    const fallbackInfo = {
      requestedHeadings: [...requestedHeadings],
      successfulHeadings: [] as number[],
      fallbacksUsed: 0,
      coveragePercent: 0
    };

    // First pass: Try all requested headings with fallbacks
    for (let i = 0; i < requestedHeadings.length; i++) {
      const heading = requestedHeadings[i];
      console.log(`🔄 Loading viewpoint ${i + 1}/${requestedHeadings.length} (${heading}°)`);
      
      const result = await fetchStreetViewWithFallback(
        lat, lng, heading, landmarkName, finalSize, googleApiKey, attemptedHeadings
      );
      
      if (result.data) {
        successfulViewpoints.push(result.data);
        fallbackInfo.successfulHeadings.push(result.actualHeading);
        if (result.fallbackUsed) {
          fallbackInfo.fallbacksUsed++;
        }
      }
    }

    // Second pass: Try alternative headings if we don't have enough viewpoints
    const alternativeHeadings = tryAlternativeHeadings(
      requestedHeadings, 
      fallbackInfo.successfulHeadings, 
      viewpoints
    );
    
    for (const heading of alternativeHeadings) {
      if (successfulViewpoints.length >= 4) break; // Don't need more than 4 viewpoints
      
      console.log(`🔄 Trying alternative heading: ${heading}°`);
      const result = await fetchStreetViewWithFallback(
        lat, lng, heading, landmarkName, finalSize, googleApiKey, attemptedHeadings
      );
      
      if (result.data) {
        successfulViewpoints.push(result.data);
        fallbackInfo.successfulHeadings.push(result.actualHeading);
        fallbackInfo.fallbacksUsed++;
      }
    }

    // Filter viewpoints to ensure minimum spacing
    const filteredViewpoints = filterByMinimumSpacing(successfulViewpoints);

    if (filteredViewpoints.length === 0) {
      console.log(`❌ No Street View available for ${landmarkName} from any angle`);
      return new Response(JSON.stringify({
        error: 'Street View not available at this location from any angle',
        landmarkName,
        attemptedHeadings: Array.from(attemptedHeadings),
        strategy: viewpoints,
        fallbackInfo
      }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Calculate final statistics
    fallbackInfo.coveragePercent = Math.round((filteredViewpoints.length / requestedHeadings.length) * 100);
    
    // Primary view is the first viewpoint (usually closest to north-facing)
    const primary = filteredViewpoints[0];
    
    // Enhanced metadata calculation
    const imageSize = finalSize.split('x').map(Number);
    const estimatedKbPerImage = (imageSize[0] * imageSize[1] * 0.8) / 1024; // Rough JPEG estimate
    const totalDataKb = Math.round(estimatedKbPerImage * filteredViewpoints.length);
    
    // Calculate recommended view based on landmark type and orientation
    const recommendedViewIndex = getRecommendedView(filteredViewpoints, landmarkType);
    
    console.log(`✅ Enhanced Street View loaded:`, {
      landmark: landmarkName,
      strategy: viewpoints,
      requested: requestedHeadings.length,
      successful: filteredViewpoints.length,
      fallbacks: fallbackInfo.fallbacksUsed,
      coverage: `${fallbackInfo.coveragePercent}%`,
      dataUsage: `${totalDataKb}KB`
    });

    const response: MultiViewpointResponse = {
      primary,
      viewpoints: filteredViewpoints,
      metadata: {
        totalViews: filteredViewpoints.length,
        recommendedView: recommendedViewIndex,
        dataUsage: `${totalDataKb}KB (${filteredViewpoints.length} views)`,
        ...(includeMetadata && {
          strategy: viewpoints,
          quality,
          landmarkType,
          imageSize: finalSize,
          loadingTime: Date.now(),
          networkOptimized: quality === 'low' || quality === 'medium',
          availableHeadings: filteredViewpoints.map(vp => vp.heading),
          coverage: `${fallbackInfo.coveragePercent}%`,
          fallbackInfo
        })
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
      details: error.message,
      timestamp: new Date().toISOString()
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

// Helper function to determine recommended view
const getRecommendedView = (viewpoints: StreetViewData[], landmarkType: string): number => {
  if (viewpoints.length === 1) return 0;
  
  // For monuments and statues, prefer front-facing views (0° or 180°)
  if (landmarkType === 'monument' || landmarkType === 'statue') {
    const frontView = viewpoints.findIndex(vp => vp.heading === 0 || vp.heading === 180);
    if (frontView !== -1) return frontView;
  }
  
  // For buildings, prefer street-facing views (0° typically)
  if (landmarkType === 'building') {
    const streetView = viewpoints.findIndex(vp => vp.heading === 0);
    if (streetView !== -1) return streetView;
  }
  
  // Default to first viewpoint
  return 0;
};
