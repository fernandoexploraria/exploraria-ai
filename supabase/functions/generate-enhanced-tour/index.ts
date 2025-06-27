
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GeminiResponse {
  response: string;
}

interface Place {
  name: string;
  description: string;
}

interface PlacesAPIResponse {
  results: any[];
  error?: string;
}

interface GeocodingAPIResponse {
  results: any[];
  error?: string;
}

interface EnhancedLandmark {
  id: string;
  name: string;
  coordinates: [number, number]; // [lng, lat]
  description: string;
  placeId?: string;
  coordinateSource: 'gemini' | 'places_api' | 'geocoding_api' | 'fallback';
  confidence: 'high' | 'medium' | 'low';
  rating?: number;
  photos?: string[];
  types?: string[];
  formattedAddress?: string;
}

interface CoordinateQuality {
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
}

interface TourMetadata {
  totalLandmarks: number;
  coordinateQuality: CoordinateQuality;
  processingTime: number;
  fallbacksUsed: string[];
}

interface SearchStrategy {
  name: string;
  query: string;
  confidence: 'high' | 'medium' | 'low';
}

interface GeographicContext {
  city: string;
  state: string;
  country: string;
  region?: string;
  administrativeAreas: string[];
  cityBounds: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
  cityType: 'major_city' | 'small_city' | 'town' | 'neighborhood';
}

interface ProcessingError {
  type: 'API_ERROR' | 'VALIDATION_ERROR' | 'PROCESSING_ERROR' | 'TIMEOUT_ERROR';
  message: string;
  details?: any;
  timestamp: number;
}

/**
 * Enhanced error logging utility
 */
function logError(error: any, context: string, additionalData?: any): ProcessingError {
  const processedError: ProcessingError = {
    type: 'PROCESSING_ERROR',
    message: error?.message || 'Unknown error',
    details: { context, error: error?.stack, additionalData },
    timestamp: Date.now()
  };

  // Categorize error types
  if (error?.message?.includes('API')) {
    processedError.type = 'API_ERROR';
  } else if (error?.message?.includes('timeout') || error?.message?.includes('Timeout')) {
    processedError.type = 'TIMEOUT_ERROR';
  } else if (error?.message?.includes('Invalid') || error?.message?.includes('validation')) {
    processedError.type = 'VALIDATION_ERROR';
  }

  console.error(`❌ [${processedError.type}] ${context}:`, {
    message: processedError.message,
    details: processedError.details,
    timestamp: new Date(processedError.timestamp).toISOString()
  });

  return processedError;
}

/**
 * Safe coordinate validation with comprehensive error handling
 */
function safeValidateCoordinates(coordinates: any, landmarkName: string): [number, number] | null {
  try {
    if (!coordinates) {
      console.warn(`⚠️ Missing coordinates for ${landmarkName}`);
      return null;
    }

    let lng: number, lat: number;

    // Handle different coordinate formats
    if (Array.isArray(coordinates)) {
      if (coordinates.length !== 2) {
        console.warn(`⚠️ Invalid coordinate array length for ${landmarkName}:`, coordinates);
        return null;
      }
      [lng, lat] = coordinates.map(Number);
    } else if (typeof coordinates === 'object') {
      lng = Number(coordinates.lng || coordinates.longitude);
      lat = Number(coordinates.lat || coordinates.latitude);
    } else {
      console.warn(`⚠️ Unsupported coordinate format for ${landmarkName}:`, typeof coordinates);
      return null;
    }

    // Validate coordinate ranges
    if (isNaN(lng) || isNaN(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      console.warn(`⚠️ Invalid coordinate values for ${landmarkName}:`, { lng, lat });
      return null;
    }

    console.log(`✅ Valid coordinates for ${landmarkName}: [${lng}, ${lat}]`);
    return [lng, lat];
  } catch (error) {
    logError(error, `Coordinate validation for ${landmarkName}`, { coordinates });
    return null;
  }
}

/**
 * Safe distance calculation with error handling
 */
function safeCalculateDistance(coord1: any, coord2: any): number {
  try {
    const normalizedCoord1 = safeValidateCoordinates(coord1, 'coord1');
    const normalizedCoord2 = safeValidateCoordinates(coord2, 'coord2');

    if (!normalizedCoord1 || !normalizedCoord2) {
      console.warn('⚠️ Cannot calculate distance: invalid coordinates');
      return Infinity;
    }

    const [lng1, lat1] = normalizedCoord1;
    const [lng2, lat2] = normalizedCoord2;

    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;
    console.log(`📏 Distance calculated: ${distance.toFixed(2)}m`);
    return distance;
  } catch (error) {
    logError(error, 'Distance calculation', { coord1, coord2 });
    return Infinity;
  }
}

/**
 * Enhanced geographic context retrieval with error handling
 */
async function getGeographicContext(destination: string): Promise<GeographicContext> {
  console.log(`🌍 Getting geographic context for: ${destination}`);
  const startTime = Date.now();
  
  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error('Google Maps API key not configured');
    }

    const geocodingApiUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination)}&key=${GOOGLE_MAPS_API_KEY}`;
    console.log(`🔍 Calling Geocoding API...`);

    const response = await fetch(geocodingApiUrl);
    const data = await response.json();
    const duration = Date.now() - startTime;

    console.log(`⏱️ Geocoding API response in ${duration}ms, status: ${data.status}`);

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      throw new Error(`Geocoding API error: ${data.error_message || data.status}`);
    }

    const result = data.results[0];
    const addressComponents = result.address_components;

    // Extract components safely
    const cityComponent = addressComponents?.find((c: any) => c.types?.includes('locality'));
    const stateComponent = addressComponents?.find((c: any) => c.types?.includes('administrative_area_level_1'));
    const countryComponent = addressComponents?.find((c: any) => c.types?.includes('country'));

    const context: GeographicContext = {
      city: cityComponent?.long_name || destination,
      state: stateComponent?.long_name || '',
      country: countryComponent?.long_name || '',
      administrativeAreas: [],
      cityBounds: {
        northeast: result.geometry?.viewport?.northeast || { lat: 0, lng: 0 },
        southwest: result.geometry?.viewport?.southwest || { lat: 0, lng: 0 }
      },
      cityType: 'town'
    };

    console.log(`✅ Geographic context retrieved:`, context);
    return context;

  } catch (error) {
    logError(error, 'Geographic context retrieval', { destination });
    throw error;
  }
}

/**
 * Enhanced search strategies with error handling
 */
async function generateSearchStrategies(landmarkName: string, context: GeographicContext): Promise<SearchStrategy[]> {
  try {
    const { city, state, country } = context;
    
    const strategies: SearchStrategy[] = [
      {
        name: 'Specific Landmark in City',
        query: `${landmarkName} in ${city}`,
        confidence: 'high'
      },
      {
        name: 'Landmark in City, State',
        query: `${landmarkName} in ${city}, ${state}`,
        confidence: 'medium'
      },
      {
        name: 'Landmark in City, Country',
        query: `${landmarkName} in ${city}, ${country}`,
        confidence: 'medium'
      },
      {
        name: 'Just the Landmark Name',
        query: `${landmarkName}`,
        confidence: 'low'
      }
    ];

    console.log(`🎯 Generated ${strategies.length} search strategies for "${landmarkName}"`);
    return strategies;
  } catch (error) {
    logError(error, 'Search strategy generation', { landmarkName, context });
    return [{
      name: 'Fallback Search',
      query: landmarkName,
      confidence: 'low'
    }];
  }
}

/**
 * Enhanced Places API search with comprehensive error handling
 */
async function searchPlacesWithStrategy(
  strategy: SearchStrategy,
  context: GeographicContext,
  retryCount: number = 0
): Promise<any | null> {
  const maxRetries = 2;
  const startTime = Date.now();
  
  try {
    console.log(`🔍 Places API search: "${strategy.query}" (attempt ${retryCount + 1})`);
    
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error('Google Maps API key not configured');
    }

    const encodedQuery = encodeURIComponent(strategy.query);
    const baseUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodedQuery}&inputtype=textquery&fields=name,geometry,place_id,rating,photos,types,formatted_address&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(baseUrl);
    const data: PlacesAPIResponse = await response.json();
    const duration = Date.now() - startTime;

    console.log(`⏱️ Places API response in ${duration}ms for "${strategy.query}"`);

    if (data.error) {
      throw new Error(`Places API error: ${data.error}`);
    }

    if (!data.results || data.results.length === 0) {
      if (retryCount < maxRetries) {
        console.log(`🔄 No results for "${strategy.query}". Retrying... (${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return searchPlacesWithStrategy(strategy, context, retryCount + 1);
      } else {
        console.warn(`❌ No results found for "${strategy.query}" after ${maxRetries + 1} attempts`);
        return null;
      }
    }

    const result = data.results[0];
    console.log(`✅ Places API found: ${result.name} for query "${strategy.query}"`);
    return result;

  } catch (error) {
    logError(error, `Places API search for "${strategy.query}"`, { strategy, retryCount });
    
    if (retryCount < maxRetries) {
      console.log(`🔄 Retrying Places API search for "${strategy.query}" (${retryCount + 1})`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      return searchPlacesWithStrategy(strategy, context, retryCount + 1);
    }
    
    return null;
  }
}

/**
 * Enhanced Geocoding API fallback with error handling
 */
async function callGeocodingAPI(query: string, retryCount: number = 0): Promise<any | null> {
  const maxRetries = 2;
  const startTime = Date.now();
  
  try {
    console.log(`🌐 Geocoding API search: "${query}" (attempt ${retryCount + 1})`);
    
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error('Google Maps API key not configured');
    }

    const encodedQuery = encodeURIComponent(query);
    const geocodingApiUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedQuery}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(geocodingApiUrl);
    const data: GeocodingAPIResponse = await response.json();
    const duration = Date.now() - startTime;

    console.log(`⏱️ Geocoding API response in ${duration}ms for "${query}"`);

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      if (retryCount < maxRetries) {
        console.log(`🔄 Geocoding API failed for "${query}". Retrying... (${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return callGeocodingAPI(query, retryCount + 1);
      } else {
        console.warn(`❌ Geocoding API failed for "${query}" after ${maxRetries + 1} attempts: ${data.status}`);
        return null;
      }
    }

    const result = data.results[0];
    console.log(`✅ Geocoding API found coordinates for "${query}"`);
    return result;

  } catch (error) {
    logError(error, `Geocoding API search for "${query}"`, { query, retryCount });
    
    if (retryCount < maxRetries) {
      console.log(`🔄 Retrying Geocoding API search for "${query}" (${retryCount + 1})`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      return callGeocodingAPI(query, retryCount + 1);
    }
    
    return null;
  }
}

/**
 * Enhanced coordinate refinement with comprehensive error handling
 */
async function refineCoordinates(
  landmarks: any[],
  context: GeographicContext
): Promise<EnhancedLandmark[]> {
  console.log(`🔍 Starting coordinate refinement for ${landmarks.length} landmarks`);
  const startTime = Date.now();
  
  const enhancedLandmarks: EnhancedLandmark[] = [];
  const processingStats = {
    successful: 0,
    failed: 0,
    fallbacks: [] as string[]
  };

  for (let i = 0; i < landmarks.length; i++) {
    const landmark = landmarks[i];
    console.log(`\n🏛️ Processing landmark ${i + 1}/${landmarks.length}: ${landmark.name}`);
    
    try {
      // Generate search strategies
      const strategies = await generateSearchStrategies(landmark.name, context);
      
      let bestResult: any = null;
      let usedStrategy: SearchStrategy | null = null;
      let coordinateSource: EnhancedLandmark['coordinateSource'] = 'fallback';
      let confidence: EnhancedLandmark['confidence'] = 'low';

      // Try each strategy
      for (const strategy of strategies) {
        try {
          const result = await searchPlacesWithStrategy(strategy, context);
          
          if (result && result.geometry && result.geometry.location) {
            const coords = safeValidateCoordinates([result.geometry.location.lng, result.geometry.location.lat], landmark.name);
            if (coords) {
              bestResult = result;
              usedStrategy = strategy;
              coordinateSource = 'places_api';
              confidence = strategy.confidence;
              console.log(`✅ Found coordinates via Places API: ${landmark.name}`);
              break;
            }
          }
        } catch (error) {
          logError(error, `Strategy ${strategy.name} for ${landmark.name}`, { strategy });
          continue;
        }
      }

      // Fallback to geocoding if Places API failed
      if (!bestResult) {
        console.log(`🔄 Falling back to Geocoding API for: ${landmark.name}`);
        try {
          const geocodingResult = await callGeocodingAPI(`${landmark.name} ${context.city} ${context.country}`);
          if (geocodingResult && geocodingResult.geometry && geocodingResult.geometry.location) {
            const coords = safeValidateCoordinates([geocodingResult.geometry.location.lng, geocodingResult.geometry.location.lat], landmark.name);
            if (coords) {
              bestResult = geocodingResult;
              coordinateSource = 'geocoding_api';
              confidence = 'medium';
              processingStats.fallbacks.push(`${landmark.name}: geocoding_api`);
              console.log(`✅ Found coordinates via Geocoding API: ${landmark.name}`);
            }
          }
        } catch (error) {
          logError(error, `Geocoding fallback for ${landmark.name}`, { landmark });
        }
      }

      // Create enhanced landmark if we found valid coordinates
      if (bestResult) {
        const validatedCoords = safeValidateCoordinates([bestResult.geometry.location.lng, bestResult.geometry.location.lat], landmark.name);
        if (validatedCoords) {
          const enhanced: EnhancedLandmark = {
            id: `landmark-${i + 1}`,
            name: landmark.name,
            coordinates: validatedCoords,
            description: landmark.description,
            placeId: bestResult.place_id,
            coordinateSource,
            confidence,
            rating: bestResult.rating,
            photos: bestResult.photos?.map((photo: any) => photo.photo_reference) || [],
            types: bestResult.types || [],
            formattedAddress: bestResult.formatted_address
          };
          
          enhancedLandmarks.push(enhanced);
          processingStats.successful++;
          console.log(`✅ Enhanced landmark created: ${landmark.name} (${confidence} confidence)`);
        } else {
          console.error(`❌ Final coordinate validation failed for ${landmark.name}`);
          processingStats.failed++;
        }
      } else {
        console.error(`❌ No valid coordinates found for ${landmark.name}`);
        processingStats.failed++;
      }
    } catch (error) {
      logError(error, `Processing ${landmark.name}`, { landmark });
      processingStats.failed++;
    }
  }

  const duration = Date.now() - startTime;
  console.log(`📊 Coordinate refinement completed in ${duration}ms: ${processingStats.successful} successful, ${processingStats.failed} failed`);
  
  return enhancedLandmarks;
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  console.log(`🚀 [${requestId}] Enhanced tour generation request started`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate request
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      console.error(`❌ [${requestId}] Invalid JSON in request body`);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON in request body',
          requestId 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { destination } = requestBody;
    
    if (!destination || typeof destination !== 'string' || destination.trim().length === 0) {
      console.error(`❌ [${requestId}] Invalid destination:`, destination);
      return new Response(
        JSON.stringify({ 
          error: 'Valid destination is required',
          requestId 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`📍 [${requestId}] Processing destination: ${destination}`);

    // Phase 1: Get geographic context
    console.log(`🌍 [${requestId}] Phase 1: Getting geographic context...`);
    let context: GeographicContext;
    try {
      context = await getGeographicContext(destination);
      console.log(`✅ [${requestId}] Geographic context retrieved successfully`);
    } catch (error) {
      logError(error, `Geographic context for ${destination}`, { requestId });
      return new Response(
        JSON.stringify({ 
          error: `Failed to determine geographic context: ${error.message}`,
          requestId 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Phase 2: Generate landmarks using Gemini
    console.log(`🤖 [${requestId}] Phase 2: Calling Gemini for landmark generation...`);
    let landmarks: any[];
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );

      const { data: geminiData, error: geminiError } = await supabase.functions.invoke('gemini-chat', {
        body: {
          prompt: `Generate a comprehensive list of 10 famous landmarks, attractions, and points of interest in ${destination}. 
          
          Format your response as a JSON array with this exact structure:
          [
            {
              "name": "Landmark Name",
              "description": "Brief description of the landmark and its significance"
            }
          ]
          
          Focus on:
          - Well-known tourist attractions
          - Historical sites and monuments  
          - Museums and cultural centers
          - Architectural landmarks
          - Religious sites
          - Parks and natural features
          - Local markets or districts
          
          Ensure each landmark name is specific and searchable. Avoid generic terms.`,
          systemInstruction: `You are a knowledgeable travel guide specializing in ${destination}. Provide accurate, specific landmark information that would be useful for tourists. Return only valid JSON without any additional text or formatting.`
        }
      });

      if (geminiError) {
        logError(geminiError, 'Gemini API call', { requestId, destination });
        return new Response(
          JSON.stringify({ 
            error: `Gemini API error: ${geminiError.message}`,
            requestId 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`📝 [${requestId}] Gemini response received, parsing...`);
      
      try {
        landmarks = JSON.parse(geminiData.response);
        if (!Array.isArray(landmarks) || landmarks.length === 0) {
          throw new Error('Invalid landmarks data structure');
        }
        console.log(`✅ [${requestId}] Parsed ${landmarks.length} landmarks from Gemini`);
      } catch (parseError) {
        logError(parseError, 'Gemini response parsing', { requestId, response: geminiData.response });
        return new Response(
          JSON.stringify({ 
            error: 'Invalid JSON response from Gemini AI',
            requestId 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } catch (error) {
      logError(error, 'Gemini landmark generation', { requestId });
      return new Response(
        JSON.stringify({ 
          error: `Failed to generate landmarks: ${error.message}`,
          requestId 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Phase 3: Refine coordinates
    console.log(`🔍 [${requestId}] Phase 3: Refining coordinates...`);
    let enhancedLandmarks: EnhancedLandmark[];
    try {
      enhancedLandmarks = await refineCoordinates(landmarks, context);
      
      if (enhancedLandmarks.length === 0) {
        throw new Error('No landmarks could be processed with valid coordinates');
      }
      
      console.log(`✅ [${requestId}] Coordinate refinement completed: ${enhancedLandmarks.length} landmarks processed`);
    } catch (error) {
      logError(error, 'Coordinate refinement', { requestId });
      return new Response(
        JSON.stringify({ 
          error: `Failed to refine coordinates: ${error.message}`,
          requestId 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Phase 4: Generate system prompt and metadata
    console.log(`📊 [${requestId}] Phase 4: Generating system prompt and metadata...`);
    try {
      const qualityMetrics: CoordinateQuality = {
        highConfidence: enhancedLandmarks.filter(l => l.confidence === 'high').length,
        mediumConfidence: enhancedLandmarks.filter(l => l.confidence === 'medium').length,
        lowConfidence: enhancedLandmarks.filter(l => l.confidence === 'low').length
      };

      const systemPrompt = `You are an expert tour guide for ${destination}. You have extensive knowledge about the following landmarks and attractions:

${enhancedLandmarks.map(landmark => `- ${landmark.name}: ${landmark.description}`).join('\n')}

When users ask about these locations, provide detailed, engaging information about their history, significance, and visitor tips. Be enthusiastic and informative while being concise.`;

      const processingTime = Date.now() - startTime;
      const metadata: TourMetadata = {
        totalLandmarks: enhancedLandmarks.length,
        coordinateQuality: qualityMetrics,
        processingTime,
        fallbacksUsed: []
      };

      console.log(`✅ [${requestId}] Enhanced tour generation completed successfully in ${processingTime}ms`);
      console.log(`📊 [${requestId}] Quality metrics:`, qualityMetrics);

      return new Response(
        JSON.stringify({
          landmarks: enhancedLandmarks,
          systemPrompt,
          metadata,
          requestId
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );

    } catch (error) {
      logError(error, 'System prompt generation', { requestId });
      return new Response(
        JSON.stringify({ 
          error: `Failed to generate system prompt: ${error.message}`,
          requestId 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logError(error, 'Enhanced tour generation', { requestId, processingTime });
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred during tour generation',
        details: error.stack,
        requestId,
        processingTime
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
