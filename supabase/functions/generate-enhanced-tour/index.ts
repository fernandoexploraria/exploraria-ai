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

/**
 * Enhanced distance calculation with proper coordinate validation
 */
function calculateDistance(coord1: any, coord2: any): number {
  try {
    // Validate and normalize coordinates
    const [lng1, lat1] = normalizeCoordinates(coord1);
    const [lng2, lat2] = normalizeCoordinates(coord2);
    
    // Validate coordinate ranges
    if (!isValidCoordinate(lat1, lng1) || !isValidCoordinate(lat2, lng2)) {
      console.warn('Invalid coordinates detected:', { coord1, coord2 });
      return Infinity; // Return large distance for invalid coordinates
    }

    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  } catch (error) {
    console.error('Error calculating distance:', error, { coord1, coord2 });
    return Infinity;
  }
}

/**
 * Normalize coordinates to [lng, lat] format
 */
function normalizeCoordinates(coord: any): [number, number] {
  if (!coord) {
    throw new Error('Coordinate is null or undefined');
  }

  // Handle array format [lng, lat] or [lat, lng]
  if (Array.isArray(coord)) {
    if (coord.length !== 2) {
      throw new Error(`Invalid coordinate array length: ${coord.length}`);
    }
    return [Number(coord[0]), Number(coord[1])];
  }

  // Handle object format { lng, lat } or { longitude, latitude }
  if (typeof coord === 'object') {
    const lng = coord.lng || coord.longitude;
    const lat = coord.lat || coord.latitude;
    
    if (lng === undefined || lat === undefined) {
      throw new Error('Missing lng/lat or longitude/latitude properties');
    }
    
    return [Number(lng), Number(lat)];
  }

  throw new Error(`Unsupported coordinate format: ${typeof coord}`);
}

/**
 * Validate coordinate ranges
 */
function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) && !isNaN(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

/**
 * Enhanced coordinate validation with detailed logging
 */
function validateCoordinates(coordinates: any, landmarkName: string): [number, number] | null {
  try {
    const normalized = normalizeCoordinates(coordinates);
    const [lng, lat] = normalized;
    
    if (!isValidCoordinate(lat, lng)) {
      console.warn(`❌ Invalid coordinates for ${landmarkName}:`, { coordinates, normalized });
      return null;
    }
    
    console.log(`✅ Valid coordinates for ${landmarkName}:`, normalized);
    return normalized;
  } catch (error) {
    console.error(`❌ Coordinate validation error for ${landmarkName}:`, error.message, { coordinates });
    return null;
  }
}

async function getGeographicContext(destination: string): Promise<GeographicContext> {
  const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
  const geocodingApiUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination)}&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await fetch(geocodingApiUrl);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.error('Geocoding API failed:', data.status, data.error_message);
      throw new Error(`Geocoding API error: ${data.error_message || data.status}`);
    }

    const result = data.results[0];
    const addressComponents = result.address_components;

    // Extract relevant information
    const cityComponent = addressComponents.find((c: any) => c.types.includes('locality'));
    const cityTypeComponent = addressComponents.find((c: any) => c.types.includes('administrative_area_level_2'));
    const stateComponent = addressComponents.find((c: any) => c.types.includes('administrative_area_level_1'));
    const countryComponent = addressComponents.find((c: any) => c.types.includes('country'));
    const neighborhoodComponent = addressComponents.find((c: any) => c.types.includes('neighborhood'));

    const administrativeAreas = addressComponents
      .filter((c: any) => c.types.includes('administrative_area_level_3') || c.types.includes('administrative_area_level_4'))
      .map((c: any) => c.long_name);

    const city = cityComponent ? cityComponent.long_name : (cityTypeComponent ? cityTypeComponent.long_name : destination);
    const state = stateComponent ? stateComponent.long_name : '';
    const country = countryComponent ? countryComponent.long_name : '';
    const cityType = cityTypeComponent ? (cityTypeComponent.types.includes('major_city') ? 'major_city' : 'small_city') : 'town';

    // Get viewport bounds
    const viewport = result.geometry.viewport;
    const cityBounds = {
      northeast: viewport.northeast,
      southwest: viewport.southwest
    };

    return {
      city,
      state,
      country,
      cityBounds,
      cityType,
      administrativeAreas
    };

  } catch (error) {
    console.error('Error in getGeographicContext:', error);
    throw new Error(`Failed to determine geographic context for ${destination}`);
  }
}

async function generateSearchStrategies(landmarkName: string, context: GeographicContext): Promise<SearchStrategy[]> {
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
      name: 'Landmark near City Center',
      query: `${landmarkName} near ${city} center`,
      confidence: 'low'
    },
    {
      name: 'Just the Landmark Name',
      query: `${landmarkName}`,
      confidence: 'low'
    }
  ];

  return strategies;
}

async function searchPlacesWithStrategy(
  strategy: SearchStrategy,
  context: GeographicContext,
  retryCount: number = 0
): Promise<any | null> {
  const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
  const { city, country } = context;
  const encodedQuery = encodeURIComponent(strategy.query);
  const baseUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodedQuery}&inputtype=textquery&fields=name,geometry,place_id,rating,photos,types,formatted_address&locationbias=circle:20000@${city},${country}&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await fetch(baseUrl);
    const data: PlacesAPIResponse = await response.json();

    if (data.error) {
      throw new Error(`Places API error: ${data.error}`);
    }

    if (!data.results || data.results.length === 0) {
      if (retryCount < 2) {
        console.log(`No results for "${strategy.query}". Retrying... (${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        return searchPlacesWithStrategy(strategy, context, retryCount + 1);
      } else {
        console.warn(`No results found for "${strategy.query}" after multiple retries.`);
        return null;
      }
    }

    return data.results[0];
  } catch (error) {
    console.error(`Error in searchPlacesWithStrategy for "${strategy.query}":`, error);
    return null;
  }
}

async function callGeocodingAPI(query: string, retryCount: number = 0): Promise<any | null> {
  const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
  const encodedQuery = encodeURIComponent(query);
  const geocodingApiUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedQuery}&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await fetch(geocodingApiUrl);
    const data: GeocodingAPIResponse = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      if (retryCount < 2) {
        console.log(`Geocoding API failed for "${query}". Retrying... (${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        return callGeocodingAPI(query, retryCount + 1);
      } else {
        console.warn(`Geocoding API failed for "${query}" after multiple retries: ${data.status} - ${data.error_message}`);
        return null;
      }
    }

    return data.results[0];
  } catch (error) {
    console.error(`Error in callGeocodingAPI for "${query}":`, error);
    return null;
  }
}

/**
 * Enhanced coordinate refinement with proper error handling
 */
async function refineCoordinates(
  landmarks: any[],
  context: GeographicContext
): Promise<EnhancedLandmark[]> {
  console.log(`🔍 Refining coordinates for ${landmarks.length} landmarks with enhanced logging and quality assessment...`);
  
  const enhancedLandmarks: EnhancedLandmark[] = [];
  const processingResults = {
    successful: 0,
    failed: 0,
    fallbacks: [] as string[]
  };

  for (let i = 0; i < landmarks.length; i++) {
    const landmark = landmarks[i];
    console.log(`\n🏛️ Processing: ${landmark.name}`);
    
    try {
      // Generate search strategies
      const strategies = await generateSearchStrategies(landmark.name, context);
      console.log(`🔍 Generated ${strategies.length} search strategies for "${landmark.name}"`);
      
      let bestResult: any = null;
      let usedStrategy: SearchStrategy | null = null;
      let coordinateSource: EnhancedLandmark['coordinateSource'] = 'fallback';
      let confidence: EnhancedLandmark['confidence'] = 'low';

      // Try each strategy
      for (const strategy of strategies) {
        try {
          console.log(`📊 API Attempt ${strategies.indexOf(strategy) + 1}: ${strategy.name} - "${strategy.query}" (retry 1)`);
          
          const startTime = Date.now();
          const result = await searchPlacesWithStrategy(strategy, context);
          const duration = Date.now() - startTime;
          
          if (result && result.geometry && result.geometry.location) {
            console.log(`✅ API Success ${strategies.indexOf(strategy) + 1}: ${duration}ms - Found coordinates: ${result.geometry.location.lng},${result.geometry.location.lat}`);
            
            // Validate coordinates before using
            const coords = validateCoordinates([result.geometry.location.lng, result.geometry.location.lat], landmark.name);
            if (coords) {
              bestResult = result;
              usedStrategy = strategy;
              coordinateSource = 'places_api';
              confidence = strategy.confidence;
              break;
            }
          }
        } catch (error) {
          console.error(`❌ Strategy ${strategy.name} failed:`, error.message);
          continue;
        }
      }

      // Fallback to geocoding if Places API failed
      if (!bestResult) {
        console.log(`🔄 Falling back to Geocoding API for: ${landmark.name}`);
        try {
          const geocodingResult = await callGeocodingAPI(`${landmark.name} ${context.city} ${context.country}`);
          if (geocodingResult && geocodingResult.geometry && geocodingResult.geometry.location) {
            const coords = validateCoordinates([geocodingResult.geometry.location.lng, geocodingResult.geometry.location.lat], landmark.name);
            if (coords) {
              bestResult = geocodingResult;
              coordinateSource = 'geocoding_api';
              confidence = 'medium';
              processingResults.fallbacks.push(`${landmark.name}: geocoding_api`);
            }
          }
        } catch (error) {
          console.error(`❌ Geocoding fallback failed for ${landmark.name}:`, error.message);
        }
      }

      // Create enhanced landmark
      if (bestResult) {
        const validatedCoords = validateCoordinates([bestResult.geometry.location.lng, bestResult.geometry.location.lat], landmark.name);
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
          processingResults.successful++;
          console.log(`✅ Enhanced landmark created: ${landmark.name} (${confidence} confidence)`);
        } else {
          console.error(`❌ Final coordinate validation failed for ${landmark.name}`);
          processingResults.failed++;
        }
      } else {
        console.error(`❌ No valid coordinates found for ${landmark.name}`);
        processingResults.failed++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${landmark.name}:`, error.message);
      processingResults.failed++;
    }
  }

  console.log(`📊 Coordinate refinement completed: ${processingResults.successful} successful, ${processingResults.failed} failed`);
  
  return enhancedLandmarks;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destination } = await req.json();
    console.log(`🚀 Starting enhanced tour generation with advanced validation and quality assessment for: ${destination}`);

    // Get geographic context
    const context = await getGeographicContext(destination);
    console.log(`📍 Geographic context: ${JSON.stringify(context, null, 2)}`);

    // Get city center coordinates for reference
    const cityCenter = [(context.cityBounds.northeast.lng + context.cityBounds.southwest.lng) / 2,
                       (context.cityBounds.northeast.lat + context.cityBounds.southwest.lat) / 2];
    console.log(`📍 City center coordinates: ${JSON.stringify(cityCenter)}`);

    // Generate landmarks using Gemini
    console.log(`🤖 Calling Gemini for landmark names and descriptions...`);
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
      console.error('❌ Gemini API error:', geminiError);
      throw new Error(`Gemini API error: ${geminiError.message}`);
    }

    console.log('📝 Got Gemini response, parsing...');
    let landmarks;
    try {
      landmarks = JSON.parse(geminiData.response);
    } catch (parseError) {
      console.error('❌ Failed to parse Gemini response:', parseError);
      throw new Error('Invalid JSON response from Gemini');
    }

    if (!Array.isArray(landmarks) || landmarks.length === 0) {
      throw new Error('Invalid landmarks data from Gemini');
    }

    // Refine coordinates with enhanced error handling
    const startTime = Date.now();
    const enhancedLandmarks = await refineCoordinates(landmarks, context);
    const processingTime = Date.now() - startTime;

    if (enhancedLandmarks.length === 0) {
      throw new Error('No landmarks could be processed with valid coordinates');
    }

    // Calculate quality metrics
    const qualityMetrics: CoordinateQuality = {
      highConfidence: enhancedLandmarks.filter(l => l.confidence === 'high').length,
      mediumConfidence: enhancedLandmarks.filter(l => l.confidence === 'medium').length,
      lowConfidence: enhancedLandmarks.filter(l => l.confidence === 'low').length
    };

    // Generate system prompt
    const systemPrompt = `You are an expert tour guide for ${destination}. You have extensive knowledge about the following landmarks and attractions:

${enhancedLandmarks.map(landmark => `- ${landmark.name}: ${landmark.description}`).join('\n')}

**Location Awareness (Internal Context Updates):**
From time to time, you will receive internal \`contextual_update\` messages from the system. These messages will be formatted like:
'System Alert: User is now near [POI Name]. It is a [primaryType] located at [coordinates]. A key fact about it: [brief summary/fact].'
This information is background context provided by the user's location tracking system.

**Handling Nearby POIs:**
- **Do not interrupt the user or your current thought mid-sentence when you receive a 'System Alert'.** Let the current conversational turn complete naturally.
- **After the user has finished speaking, or during a natural conversational pause (if you are speaking about a general topic), or if you haven't mentioned a new nearby POI for a while:**
    - **Check your internal memory for recent 'System Alert' messages about POIs you haven't yet discussed.**
    - **If a new, significant POI is available:** Proactively introduce it to the user. Start with a phrase like: "Oh, how fascinating! Speaking of our journey, I've just noticed we're quite close to [POI Name]."
    - **Share an interesting fact or a brief, engaging summary** about this [POI Name] using the information provided in the 'System Alert'.
    - **Smoothly transition back** to the main tour narrative or ask a relevant follow-up question about the POI.
- **Do not repeat information about the same POI.** Once you introduce a POI, consider it discussed for the remainder of this conversation session.

When users ask about these locations, provide detailed, engaging information about their history, significance, and visitor tips. Be enthusiastic and informative while being concise.`;

    const metadata: TourMetadata = {
      totalLandmarks: enhancedLandmarks.length,
      coordinateQuality: qualityMetrics,
      processingTime,
      fallbacksUsed: [] // This would be populated during processing
    };

    console.log(`✅ Enhanced tour generation completed successfully:`);
    console.log(`   - Total landmarks: ${enhancedLandmarks.length}`);
    console.log(`   - High confidence: ${qualityMetrics.highConfidence}`);
    console.log(`   - Medium confidence: ${qualityMetrics.mediumConfidence}`);
    console.log(`   - Low confidence: ${qualityMetrics.lowConfidence}`);
    console.log(`   - Processing time: ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        landmarks: enhancedLandmarks,
        systemPrompt,
        metadata
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ Error in generate-enhanced-tour:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred during tour generation',
        details: error.stack
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
