
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

interface ProcessingError {
  type: 'API_ERROR' | 'VALIDATION_ERROR' | 'PROCESSING_ERROR' | 'TIMEOUT_ERROR' | 'CONFIG_ERROR';
  message: string;
  details?: any;
  timestamp: number;
  phase?: string;
}

interface ProcessingContext {
  requestId: string;
  startTime: number;
  destination: string;
  phase: string;
  errors: ProcessingError[];
  warnings: string[];
}

/**
 * Enhanced error logging with context
 */
function logError(error: any, context: ProcessingContext, phase: string, additionalData?: any): ProcessingError {
  const processedError: ProcessingError = {
    type: 'PROCESSING_ERROR',
    message: error?.message || 'Unknown error',
    details: { 
      context: phase, 
      error: error?.stack, 
      additionalData,
      requestId: context.requestId,
      destination: context.destination
    },
    timestamp: Date.now(),
    phase
  };

  // Categorize error types
  if (error?.message?.includes('API') || error?.message?.includes('key')) {
    processedError.type = 'API_ERROR';
  } else if (error?.message?.includes('timeout') || error?.message?.includes('Timeout')) {
    processedError.type = 'TIMEOUT_ERROR';
  } else if (error?.message?.includes('Invalid') || error?.message?.includes('validation')) {
    processedError.type = 'VALIDATION_ERROR';
  } else if (error?.message?.includes('config') || error?.message?.includes('missing')) {
    processedError.type = 'CONFIG_ERROR';
  }

  console.error(`❌ [${processedError.type}] [${context.requestId}] ${phase}:`, {
    message: processedError.message,
    destination: context.destination,
    phase,
    elapsed: Date.now() - context.startTime,
    details: processedError.details
  });

  context.errors.push(processedError);
  return processedError;
}

/**
 * Safe coordinate validation with enhanced error handling
 */
function validateCoordinates(coordinates: any, landmarkName: string, context: ProcessingContext): [number, number] | null {
  try {
    if (!coordinates) {
      context.warnings.push(`Missing coordinates for ${landmarkName}`);
      return null;
    }

    let lng: number, lat: number;

    // Handle different coordinate formats
    if (Array.isArray(coordinates)) {
      if (coordinates.length !== 2) {
        context.warnings.push(`Invalid coordinate array length for ${landmarkName}`);
        return null;
      }
      [lng, lat] = coordinates.map(Number);
    } else if (typeof coordinates === 'object') {
      lng = Number(coordinates.lng || coordinates.longitude);
      lat = Number(coordinates.lat || coordinates.latitude);
    } else {
      context.warnings.push(`Unsupported coordinate format for ${landmarkName}`);
      return null;
    }

    // Validate coordinate ranges
    if (isNaN(lng) || isNaN(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      context.warnings.push(`Invalid coordinate values for ${landmarkName}: [${lng}, ${lat}]`);
      return null;
    }

    console.log(`✅ [${context.requestId}] Valid coordinates for ${landmarkName}: [${lng}, ${lat}]`);
    return [lng, lat];
  } catch (error) {
    logError(error, context, `Coordinate validation for ${landmarkName}`, { coordinates });
    return null;
  }
}

/**
 * Enhanced API key validation
 */
function validateApiKeys(context: ProcessingContext): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!Deno.env.get('GOOGLE_MAPS_API_KEY')) {
    missing.push('GOOGLE_MAPS_API_KEY');
  }
  
  if (!Deno.env.get('SUPABASE_URL')) {
    missing.push('SUPABASE_URL');
  }
  
  if (!Deno.env.get('SUPABASE_ANON_KEY')) {
    missing.push('SUPABASE_ANON_KEY');
  }

  if (missing.length > 0) {
    console.error(`❌ [${context.requestId}] Missing required environment variables:`, missing);
  }

  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Enhanced Places API search with comprehensive error handling
 */
async function searchPlacesAPI(query: string, context: ProcessingContext): Promise<any | null> {
  const maxRetries = 2;
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 [${context.requestId}] Places API search: "${query}" (attempt ${retryCount + 1})`);
      
      const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
      if (!GOOGLE_MAPS_API_KEY) {
        throw new Error('Google Maps API key not configured');
      }

      const encodedQuery = encodeURIComponent(query);
      const baseUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodedQuery}&inputtype=textquery&fields=name,geometry,place_id,rating,photos,types,formatted_address&key=${GOOGLE_MAPS_API_KEY}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(baseUrl, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`Places API HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`⏱️ [${context.requestId}] Places API response in ${duration}ms for "${query}"`);

      if (data.status && data.status !== 'OK') {
        if (data.status === 'ZERO_RESULTS') {
          console.log(`ℹ️ [${context.requestId}] No results found for "${query}"`);
          return null;
        }
        throw new Error(`Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }

      if (!data.candidates || data.candidates.length === 0) {
        console.log(`ℹ️ [${context.requestId}] No candidates found for "${query}"`);
        return null;
      }

      const result = data.candidates[0];
      console.log(`✅ [${context.requestId}] Places API found: ${result.name} for query "${query}"`);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error.name === 'AbortError') {
        logError(new Error(`Places API timeout after ${duration}ms`), context, `Places API search for "${query}"`, { retryCount });
      } else {
        logError(error, context, `Places API search for "${query}"`, { retryCount, duration });
      }
      
      retryCount++;
      if (retryCount <= maxRetries) {
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
        console.log(`🔄 [${context.requestId}] Retrying Places API search for "${query}" in ${backoffDelay}ms (${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }
  
  return null;
}

/**
 * Enhanced Geocoding API fallback
 */
async function searchGeocodingAPI(query: string, context: ProcessingContext): Promise<any | null> {
  const maxRetries = 2;
  let retryCount = 0;
  
  while (retryCount <= maxRetries) {
    const startTime = Date.now();
    
    try {
      console.log(`🌐 [${context.requestId}] Geocoding API search: "${query}" (attempt ${retryCount + 1})`);
      
      const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
      if (!GOOGLE_MAPS_API_KEY) {
        throw new Error('Google Maps API key not configured');
      }

      const encodedQuery = encodeURIComponent(query);
      const geocodingApiUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedQuery}&key=${GOOGLE_MAPS_API_KEY}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(geocodingApiUrl, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`Geocoding API HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`⏱️ [${context.requestId}] Geocoding API response in ${duration}ms for "${query}"`);

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        if (data.status === 'ZERO_RESULTS') {
          console.log(`ℹ️ [${context.requestId}] No geocoding results found for "${query}"`);
          return null;
        }
        throw new Error(`Geocoding API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }

      const result = data.results[0];
      console.log(`✅ [${context.requestId}] Geocoding API found coordinates for "${query}"`);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error.name === 'AbortError') {
        logError(new Error(`Geocoding API timeout after ${duration}ms`), context, `Geocoding API search for "${query}"`, { retryCount });
      } else {
        logError(error, context, `Geocoding API search for "${query}"`, { retryCount, duration });
      }
      
      retryCount++;
      if (retryCount <= maxRetries) {
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
        console.log(`🔄 [${context.requestId}] Retrying Geocoding API search for "${query}" in ${backoffDelay}ms (${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }
  
  return null;
}

/**
 * Process landmarks with enhanced error handling and coordinate refinement
 */
async function processLandmarks(landmarks: any[], context: ProcessingContext): Promise<EnhancedLandmark[]> {
  console.log(`🔍 [${context.requestId}] Processing ${landmarks.length} landmarks`);
  context.phase = 'processing_landmarks';
  
  const enhancedLandmarks: EnhancedLandmark[] = [];
  const processingStats = {
    successful: 0,
    failed: 0,
    fallbacks: [] as string[]
  };

  for (let i = 0; i < landmarks.length; i++) {
    const landmark = landmarks[i];
    console.log(`🏛️ [${context.requestId}] Processing landmark ${i + 1}/${landmarks.length}: ${landmark.name}`);
    
    try {
      // Try Places API first
      let bestResult: any = null;
      let coordinateSource: EnhancedLandmark['coordinateSource'] = 'fallback';
      let confidence: EnhancedLandmark['confidence'] = 'low';

      // Search strategies in order of preference
      const searchQueries = [
        `${landmark.name} ${context.destination}`,
        `${landmark.name}`,
        `${landmark.name} landmark`
      ];

      for (const query of searchQueries) {
        try {
          const result = await searchPlacesAPI(query, context);
          
          if (result && result.geometry && result.geometry.location) {
            const coords = validateCoordinates([result.geometry.location.lng, result.geometry.location.lat], landmark.name, context);
            if (coords) {
              bestResult = result;
              coordinateSource = 'places_api';
              confidence = 'high';
              console.log(`✅ [${context.requestId}] Found coordinates via Places API: ${landmark.name}`);
              break;
            }
          }
        } catch (error) {
          logError(error, context, `Places API query: ${query}`, { landmark: landmark.name });
          continue;
        }
      }

      // Fallback to Geocoding if Places API failed
      if (!bestResult) {
        console.log(`🔄 [${context.requestId}] Falling back to Geocoding API for: ${landmark.name}`);
        try {
          const geocodingResult = await searchGeocodingAPI(`${landmark.name} ${context.destination}`, context);
          if (geocodingResult && geocodingResult.geometry && geocodingResult.geometry.location) {
            const coords = validateCoordinates([geocodingResult.geometry.location.lng, geocodingResult.geometry.location.lat], landmark.name, context);
            if (coords) {
              bestResult = geocodingResult;
              coordinateSource = 'geocoding_api';
              confidence = 'medium';
              processingStats.fallbacks.push(`${landmark.name}: geocoding_api`);
              console.log(`✅ [${context.requestId}] Found coordinates via Geocoding API: ${landmark.name}`);
            }
          }
        } catch (error) {
          logError(error, context, `Geocoding fallback for ${landmark.name}`, { landmark });
        }
      }

      // Create enhanced landmark if we found valid coordinates
      if (bestResult) {
        const validatedCoords = validateCoordinates([bestResult.geometry.location.lng, bestResult.geometry.location.lat], landmark.name, context);
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
          console.log(`✅ [${context.requestId}] Enhanced landmark created: ${landmark.name} (${confidence} confidence)`);
        } else {
          console.error(`❌ [${context.requestId}] Coordinate validation failed for ${landmark.name}`);
          processingStats.failed++;
        }
      } else {
        console.error(`❌ [${context.requestId}] No valid coordinates found for ${landmark.name}`);
        processingStats.failed++;
      }
    } catch (error) {
      logError(error, context, `Processing ${landmark.name}`, { landmark });
      processingStats.failed++;
    }
  }

  const duration = Date.now() - context.startTime;
  console.log(`📊 [${context.requestId}] Landmark processing completed in ${duration}ms: ${processingStats.successful} successful, ${processingStats.failed} failed`);
  
  return enhancedLandmarks;
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  // Initialize processing context
  const context: ProcessingContext = {
    requestId,
    startTime,
    destination: '',
    phase: 'initialization',
    errors: [],
    warnings: []
  };
  
  console.log(`🚀 [${requestId}] Enhanced tour generation request started`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Phase 1: Request validation and API key check
    context.phase = 'validation';
    
    // Validate API keys first
    const apiValidation = validateApiKeys(context);
    if (!apiValidation.valid) {
      return new Response(
        JSON.stringify({ 
          error: `Missing required configuration: ${apiValidation.missing.join(', ')}`,
          type: 'CONFIG_ERROR',
          requestId,
          phase: context.phase
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse and validate request
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      console.error(`❌ [${requestId}] Invalid JSON in request body`);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON in request body',
          type: 'VALIDATION_ERROR',
          requestId,
          phase: context.phase
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
          type: 'VALIDATION_ERROR',
          requestId,
          phase: context.phase
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    context.destination = destination.trim();
    console.log(`📍 [${requestId}] Processing destination: ${context.destination}`);

    // Phase 2: Generate landmarks using Gemini
    context.phase = 'gemini_generation';
    console.log(`🤖 [${requestId}] Phase 2: Calling Gemini for landmark generation...`);
    
    let landmarks: any[];
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );

      const { data: geminiData, error: geminiError } = await supabase.functions.invoke('gemini-chat', {
        body: {
          prompt: `Generate a comprehensive list of 8 famous landmarks, attractions, and points of interest in ${context.destination}. 
          
          Format your response as a JSON array with this exact structure:
          [
            {
              "name": "Landmark Name (be specific and searchable)",
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
          
          Ensure each landmark name is specific and searchable. Avoid generic terms.`,
          systemInstruction: `You are a knowledgeable travel guide specializing in ${context.destination}. Provide accurate, specific landmark information that would be useful for tourists. Return only valid JSON without any additional text or formatting.`
        }
      });

      if (geminiError) {
        logError(geminiError, context, 'Gemini API call');
        return new Response(
          JSON.stringify({ 
            error: `Gemini AI service error: ${geminiError.message}`,
            type: 'API_ERROR',
            requestId,
            phase: context.phase
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`📝 [${requestId}] Gemini response received, parsing...`);
      
      try {
        // Clean up the response to ensure it's valid JSON
        let cleanResponse = geminiData.response.trim();
        if (cleanResponse.startsWith('```json')) {
          cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/\s*```$/, '');
        }
        if (cleanResponse.startsWith('```')) {
          cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/\s*```$/, '');
        }
        
        landmarks = JSON.parse(cleanResponse);
        
        if (!Array.isArray(landmarks) || landmarks.length === 0) {
          throw new Error('Invalid landmarks data structure - expected non-empty array');
        }
        
        // Validate landmark structure
        for (const landmark of landmarks) {
          if (!landmark.name || !landmark.description) {
            throw new Error('Invalid landmark structure - missing name or description');
          }
        }
        
        console.log(`✅ [${requestId}] Parsed ${landmarks.length} landmarks from Gemini`);
      } catch (parseError) {
        logError(parseError, context, 'Gemini response parsing', { response: geminiData.response });
        return new Response(
          JSON.stringify({ 
            error: 'Invalid JSON response from Gemini AI',
            type: 'PROCESSING_ERROR',
            requestId,
            phase: context.phase,
            details: parseError.message
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } catch (error) {
      logError(error, context, 'Gemini landmark generation');
      return new Response(
        JSON.stringify({ 
          error: `Failed to generate landmarks: ${error.message}`,
          type: 'API_ERROR',
          requestId,
          phase: context.phase
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Phase 3: Process and enhance landmarks
    context.phase = 'coordinate_processing';
    console.log(`🔍 [${requestId}] Phase 3: Processing landmarks and refining coordinates...`);
    
    let enhancedLandmarks: EnhancedLandmark[];
    try {
      enhancedLandmarks = await processLandmarks(landmarks, context);
      
      if (enhancedLandmarks.length === 0) {
        throw new Error('No landmarks could be processed with valid coordinates');
      }
      
      console.log(`✅ [${requestId}] Coordinate processing completed: ${enhancedLandmarks.length} landmarks processed`);
    } catch (error) {
      logError(error, context, 'Coordinate processing');
      return new Response(
        JSON.stringify({ 
          error: `Failed to process coordinates: ${error.message}`,
          type: 'PROCESSING_ERROR',
          requestId,
          phase: context.phase
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Phase 4: Generate system prompt and metadata
    context.phase = 'finalization';
    console.log(`📊 [${requestId}] Phase 4: Generating system prompt and metadata...`);
    
    try {
      const qualityMetrics = {
        highConfidence: enhancedLandmarks.filter(l => l.confidence === 'high').length,
        mediumConfidence: enhancedLandmarks.filter(l => l.confidence === 'medium').length,
        lowConfidence: enhancedLandmarks.filter(l => l.confidence === 'low').length
      };

      const systemPrompt = `You are an expert tour guide for ${context.destination}. You have extensive knowledge about the following landmarks and attractions:

${enhancedLandmarks.map(landmark => `- ${landmark.name}: ${landmark.description}`).join('\n')}

When users ask about these locations, provide detailed, engaging information about their history, significance, and visitor tips. Be enthusiastic and informative while being concise.`;

      const processingTime = Date.now() - context.startTime;
      const metadata = {
        totalLandmarks: enhancedLandmarks.length,
        coordinateQuality: qualityMetrics,
        processingTime,
        fallbacksUsed: [],
        warnings: context.warnings,
        errorCount: context.errors.length
      };

      console.log(`✅ [${requestId}] Enhanced tour generation completed successfully in ${processingTime}ms`);
      console.log(`📊 [${requestId}] Quality metrics:`, qualityMetrics);
      
      if (context.warnings.length > 0) {
        console.log(`⚠️ [${requestId}] Warnings generated:`, context.warnings);
      }

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
      logError(error, context, 'System prompt generation');
      return new Response(
        JSON.stringify({ 
          error: `Failed to generate system prompt: ${error.message}`,
          type: 'PROCESSING_ERROR',
          requestId,
          phase: context.phase
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    const processingTime = Date.now() - context.startTime;
    logError(error, context, 'Enhanced tour generation');
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred during tour generation',
        type: context.errors.length > 0 ? context.errors[context.errors.length - 1].type : 'PROCESSING_ERROR',
        details: error.stack,
        requestId,
        processingTime,
        phase: context.phase,
        errorCount: context.errors.length
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
