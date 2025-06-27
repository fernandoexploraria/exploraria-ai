
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers for web app compatibility
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Load environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// OpenAI API setup
const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

// Google Maps API setup
const googleMapsApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

// Define types
interface LandmarkData {
  id: string;
  name: string;
  description: string;
  city: string;
  country: string;
  coordinates: [number, number];
}

interface EnhancedLandmark extends LandmarkData {
  coordinates: [number, number];
  placeId?: string;
  formattedAddress?: string;
  coordinateSource: string;
  confidence: string;
  qualityAssessment: QualityAssessment;
  photos: any[];
  types: string[];
  apiAttemptLog: string[];
}

interface QualityAssessment {
  qualityScore: number;
  validationResults: string[];
  processingTime: number;
  coordinateRefinementAttempts: number;
  searchAttempts: number;
  finalSearchStrategy: string;
}

interface GeographicContext {
  city: string;
  country: string;
  cityType: string;
}

class TourLogger {
  logs: string[] = [];

  log(message: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    this.logs.push(logEntry);
    console.log(logEntry);
  }

  getLogs(): string[] {
    return this.logs;
  }
}

// Function to extract geographic context
async function extractGeographicContext(city: string): Promise<GeographicContext> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert in geography. Extract the city, country, and type of city (e.g., "capital", "major", "tourist") from the user's query. Respond in JSON format.
          Example:
          Input: "Paris"
          Output: {"city": "Paris", "country": "France", "cityType": "capital"}`,
          },
          {
            role: "user",
            content: city,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const context = data.choices[0].message.content || '{}';
      return JSON.parse(context);
    } else {
      throw new Error('Invalid OpenAI response structure');
    }
  } catch (error) {
    console.error("Error extracting geographic context:", error);
    return { city: city, country: "Unknown", cityType: "major" };
  }
}

// Function to generate landmark names
async function generateLandmarkNames(city: string, country: string, cityType: string): Promise<string[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a world-class tour guide. Generate a list of 8 famous landmarks in ${city}, ${country}. Consider that this is a ${cityType} city.`,
          },
          {
            role: "user",
            content: `List 8 famous landmarks in ${city}.`,
          },
        ],
      }),
    });

    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const landmarkList = data.choices[0].message.content?.split('\n').map(item => item.replace(/^\d+\.\s*/, '')) || [];
      return landmarkList.filter(item => item.trim() !== '').slice(0, 8);
    } else {
      throw new Error('Invalid OpenAI response structure');
    }
  } catch (error) {
    console.error("Error generating landmark names:", error);
    return [];
  }
}

// Function to search for a place using Google Maps API
async function searchPlaces(query: string, cityCountry: string): Promise<{ coordinates: [number, number]; placeId?: string; formattedAddress?: string } | null> {
  const encodedQuery = encodeURIComponent(`${query} in ${cityCountry}`);
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodedQuery}&inputtype=textquery&fields=place_id,formatted_address,geometry&key=${googleMapsApiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      const coordinates: [number, number] = [candidate.geometry.location.lng, candidate.geometry.location.lat];
      return {
        coordinates,
        placeId: candidate.place_id,
        formattedAddress: candidate.formatted_address
      };
    } else {
      console.warn(`Places API failed for "${query}" with status: ${data.status}`);
      return null;
    }
  } catch (error) {
    console.error(`Error in Places API for "${query}":`, error);
    return null;
  }
}

// Function to geocode location
async function geocodeLocation(address: string): Promise<{ coordinates: [number, number] } | null> {
  const encodedAddress = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${googleMapsApiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      const coordinates: [number, number] = [location.lng, location.lat];
      return { coordinates };
    } else {
      console.warn(`Geocoding API failed for "${address}" with status: ${data.status}`);
      return null;
    }
  } catch (error) {
    console.error(`Error in Geocoding API for "${address}":`, error);
    return null;
  }
}

import { RetryManager, RetryResult } from './resilience/RetryManager.ts';
import { ErrorClassifier, ErrorHandler, ErrorCategory } from './resilience/ErrorHandler.ts';
import { CircuitBreakerRegistry } from './resilience/CircuitBreaker.ts';
import { DegradationManager } from './resilience/DegradationManager.ts';

// Enhanced API call wrapper with resilience
async function callApiWithResilience<T>(
  operation: () => Promise<T>,
  serviceName: string,
  operationName: string,
  logger: any
): Promise<T> {
  const startTime = Date.now();
  const circuitBreaker = CircuitBreakerRegistry.getBreaker(serviceName, logger);
  
  try {
    // Check if service is enabled under current degradation policy
    if (!DegradationManager.isServiceEnabled(serviceName)) {
      throw new Error(`Service ${serviceName} disabled due to degradation policy: ${DegradationManager.getCurrentPolicy().name}`);
    }

    // Execute with circuit breaker and retry logic
    const result = await circuitBreaker.execute(async () => {
      const retryResult: RetryResult<T> = await RetryManager.executeWithRetry(
        operation,
        serviceName,
        logger
      );
      
      if (!retryResult.success) {
        throw retryResult.error || new Error(`${serviceName} operation failed after retries`);
      }
      
      return retryResult.data!;
    });

    // Update service health on success
    const responseTime = Date.now() - startTime;
    DegradationManager.updateServiceHealth(serviceName, true, responseTime);
    
    logger.log(`✅ ${serviceName}/${operationName} completed successfully in ${responseTime}ms`);
    return result;

  } catch (error) {
    const responseTime = Date.now() - startTime;
    DegradationManager.updateServiceHealth(serviceName, false, responseTime);
    
    // Categorize and handle the error
    const categorizedError = ErrorClassifier.categorize(error as Error);
    const strategy = ErrorHandler.getStrategy(categorizedError);
    
    logger.log(`❌ ${serviceName}/${operationName} failed (${categorizedError.category}) - ${categorizedError.correlationId}: ${categorizedError.originalError.message}`);
    logger.log(`🔧 Suggested action: ${categorizedError.suggestedAction}`);
    
    // Handle different error categories
    if (categorizedError.category === ErrorCategory.DATA_QUALITY) {
      // For data quality issues, return null to skip this landmark
      return null as any;
    } else if (categorizedError.category === ErrorCategory.RATE_LIMIT) {
      // For rate limits, add additional delay
      await new Promise(resolve => setTimeout(resolve, 5000));
      throw error;
    } else {
      throw error;
    }
  }
}

// Enhanced Places API search with resilience
async function searchPlacesWithResilience(
  query: string,
  cityCountry: string,
  logger: any
): Promise<{ coordinates: [number, number]; placeId?: string; formattedAddress?: string } | null> {
  const cacheKey = `places_${query}_${cityCountry}`;
  
  // Check cache first if in degraded mode
  const cachedResult = DegradationManager.getCachedResult(cacheKey);
  if (cachedResult) {
    logger.log(`📦 Using cached result for Places search: ${query}`);
    return cachedResult.value;
  }

  try {
    const result = await callApiWithResilience(
      () => searchPlaces(query, cityCountry),
      'places',
      'search',
      logger
    );

    if (result) {
      // Cache successful results
      DegradationManager.setCachedResult(cacheKey, result, 3600000); // 1 hour TTL
    }

    return result;
  } catch (error) {
    logger.log(`🔄 Places API failed for "${query}", attempting fallback strategies`);
    
    // Try fallback strategies based on degradation level
    const policy = DegradationManager.getCurrentPolicy();
    
    if (policy.level <= 2 && DegradationManager.isServiceEnabled('geocoding')) {
      try {
        // Fallback to basic geocoding
        const geocodingResult = await callApiWithResilience(
          () => geocodeLocation(`${query}, ${cityCountry}`),
          'geocoding',
          'fallback',
          logger
        );
        
        if (geocodingResult) {
          const fallbackResult = {
            coordinates: geocodingResult.coordinates,
            placeId: undefined,
            formattedAddress: `${query}, ${cityCountry}`
          };
          DegradationManager.setCachedResult(cacheKey, fallbackResult, 1800000); // 30 min TTL for fallback
          return fallbackResult;
        }
      } catch (geocodingError) {
        logger.log(`🔄 Geocoding fallback also failed for "${query}"`);
      }
    }

    // Final fallback: return null to skip this landmark
    return null;
  }
}

async function generateEnhancedLandmarkNames(city: string, country: string, cityType: string, logger: any): Promise<string[]> {
  try {
    const result = await callApiWithResilience(
      () => generateLandmarkNames(city, country, cityType),
      'gemini',
      'landmark_generation',
      logger
    );
    return result;
  } catch (error) {
    logger.log(`🔄 OpenAI API failed for landmark generation, using fallback list`);
    
    // Fallback to a basic landmark list based on city type
    const fallbackLandmarks = getFallbackLandmarks(city, cityType);
    return fallbackLandmarks;
  }
}

function getFallbackLandmarks(city: string, cityType: string): string[] {
  const basicLandmarks = [
    `${city} City Center`,
    `${city} Main Square`,
    `${city} Historic District`,
    `${city} Cultural Center`,
    `${city} Museum`,
    `${city} Cathedral`,
    `${city} Town Hall`,
    `${city} Public Garden`
  ];

  return basicLandmarks.slice(0, 8); // Return 8 basic landmarks
}

// Enhanced coordinate refinement with resilience
async function refineCoordinatesWithQualityAssessment(
  landmarks: LandmarkData[],
  cityType: string,
  logger: any
): Promise<EnhancedLandmark[]> {
  logger.log(`🔍 Refining coordinates for ${landmarks.length} landmarks with enhanced resilience...`);
  
  // Log current system health
  const systemHealth = DegradationManager.getSystemHealth();
  logger.log(`🏥 System health - Level: ${systemHealth.level} (${systemHealth.policy.name}), Services: ${systemHealth.services.length}`);
  
  const enhancedLandmarks: EnhancedLandmark[] = [];
  const startTime = Date.now();

  for (let i = 0; i < landmarks.length; i++) {
    const landmark = landmarks[i];
    logger.log(`\n🏛️ Processing (${i + 1}/${landmarks.length}): ${landmark.name}`);

    try {
      const searchResult = await searchPlacesWithResilience(
        landmark.name,
        landmark.city || '',
        logger
      );

      if (searchResult) {
        const enhancedLandmark: EnhancedLandmark = {
          ...landmark,
          coordinates: searchResult.coordinates,
          placeId: searchResult.placeId,
          formattedAddress: searchResult.formattedAddress,
          coordinateSource: 'places_api_with_resilience',
          confidence: 'high',
          qualityAssessment: {
            qualityScore: 85,
            validationResults: ['coordinates_found', 'high_confidence'],
            processingTime: Date.now() - startTime,
            coordinateRefinementAttempts: 1,
            searchAttempts: 1,
            finalSearchStrategy: 'places_api_resilient'
          },
          photos: [],
          types: [],
          apiAttemptLog: [`✅ Resilient Places API success for "${landmark.name}"`]
        };

        enhancedLandmarks.push(enhancedLandmark);
        logger.log(`✅ Successfully processed "${landmark.name}" with resilient API calls`);
      } else {
        // Create a degraded landmark entry
        const degradedLandmark: EnhancedLandmark = {
          ...landmark,
          coordinates: [0, 0], // Default coordinates
          coordinateSource: 'degraded_fallback',
          confidence: 'low',
          qualityAssessment: {
            qualityScore: 20,
            validationResults: ['coordinates_unavailable', 'degraded_mode'],
            processingTime: Date.now() - startTime,
            coordinateRefinementAttempts: 0,
            searchAttempts: 0,
            finalSearchStrategy: 'degraded_fallback'
          },
          photos: [],
          types: [],
          apiAttemptLog: [`⚠️ Degraded mode: Unable to locate "${landmark.name}"`]
        };

        enhancedLandmarks.push(degradedLandmark);
        logger.log(`⚠️ Added "${landmark.name}" in degraded mode (no coordinates available)`);
      }
    } catch (error) {
      logger.log(`❌ Failed to process "${landmark.name}": ${error.message}`);
      
      // Add failed landmark with error info
      const failedLandmark: EnhancedLandmark = {
        ...landmark,
        coordinates: [0, 0],
        coordinateSource: 'error_fallback',
        confidence: 'none',
        qualityAssessment: {
          qualityScore: 0,
          validationResults: ['processing_failed'],
          processingTime: Date.now() - startTime,
          coordinateRefinementAttempts: 0,
          searchAttempts: 0,
          finalSearchStrategy: 'error_fallback'
        },
        photos: [],
        types: [],
        apiAttemptLog: [`❌ Processing failed: ${error.message}`]
      };

      enhancedLandmarks.push(failedLandmark);
    }
  }

  // Log final resilience metrics
  const circuitBreakerMetrics = CircuitBreakerRegistry.getAllMetrics();
  logger.log(`\n📊 Final Circuit Breaker Metrics:`);
  Object.entries(circuitBreakerMetrics).forEach(([service, metrics]) => {
    logger.log(`  ${service}: ${metrics.state} (${metrics.successCalls}S/${metrics.failedCalls}F, ${(metrics.failureRate * 100).toFixed(1)}% failure rate)`);
  });

  const finalSystemHealth = DegradationManager.getSystemHealth();
  logger.log(`🏥 Final system health - Level: ${finalSystemHealth.level} (${finalSystemHealth.policy.name})`);

  return enhancedLandmarks;
}

// Function to generate a tour description
async function generateTourDescription(landmarks: EnhancedLandmark[]): Promise<string> {
  try {
    const landmarkDetails = landmarks.map(landmark => `${landmark.name} (${landmark.description})`).join('; ');
    const prompt = `Generate a captivating tour description that includes the following landmarks: ${landmarkDetails}. The description should be concise, engaging, and no more than 150 words.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a world-class tour guide. Create an engaging and concise tour description.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content || "A fascinating tour!";
    } else {
      return "A fascinating tour!";
    }
  } catch (error) {
    console.error("Error generating tour description:", error);
    return "A fascinating tour!";
  }
}

// Function to store the tour data in Supabase
async function storeTourData(city: string, tourDescription: string, landmarks: EnhancedLandmark[], logs: string[]): Promise<any> {
  const tourData = {
    city,
    tourDescription,
    landmarks,
    logs,
    createdAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('tours')
    .insert([tourData]);

  if (error) {
    console.error("Error storing tour data:", error);
    throw error;
  }

  return data;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize resilience systems
  DegradationManager.clearExpiredCache();
  
  try {
    const requestBody = await req.json();
    const city = requestBody?.city || requestBody?.destination;
    
    if (!city) {
      return new Response(
        JSON.stringify({ error: 'Missing city parameter' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const tourLogger = new TourLogger();
    
    // Log resilience system initialization
    tourLogger.log(`🚀 Starting enhanced tour generation with comprehensive resilience for: ${city}`);
    tourLogger.log(`🛡️ Resilience systems initialized - Circuit breakers: Ready, Degradation manager: Level ${DegradationManager.getCurrentPolicy().level}`);

    // Extract geographic context
    tourLogger.log(`🌍 Extracting geographic context for: ${city}`);
    const geographicContext = await extractGeographicContext(city);
    tourLogger.log(`🗺️ Geographic context: ${JSON.stringify(geographicContext)}`);

    // Use resilience-enhanced landmark generation
    tourLogger.log(`🤖 Calling OpenAI for landmark names and descriptions with resilience...`);
    const landmarkNames = await generateEnhancedLandmarkNames(
      geographicContext.city,
      geographicContext.country,
      geographicContext.cityType,
      tourLogger
    );

    const landmarks: LandmarkData[] = landmarkNames.map(name => ({
      id: crypto.randomUUID(),
      name,
      description: `Discover the fascinating ${name} and learn about its rich history and cultural significance.`,
      city: geographicContext.city,
      country: geographicContext.country,
      coordinates: [0, 0] as [number, number]
    }));

    // Use resilience-enhanced coordinate refinement
    const enhancedLandmarks = await refineCoordinatesWithQualityAssessment(
      landmarks,
      geographicContext.cityType,
      tourLogger
    );

    // Generate tour description
    tourLogger.log(`✍️ Generating tour description...`);
    const tourDescription = await generateTourDescription(enhancedLandmarks);
    tourLogger.log(`📜 Tour description: ${tourDescription}`);

    // Store tour data in background (no await to avoid blocking response)
    storeTourData(city, tourDescription, enhancedLandmarks, tourLogger.getLogs())
      .then(() => {
        tourLogger.log(`✅ Tour data stored successfully in Supabase`);
      })
      .catch((error) => {
        tourLogger.log(`❌ Failed to store tour data in Supabase: ${error}`);
      });

    // Calculate statistics
    const totalLandmarks = enhancedLandmarks.length;
    const landmarksWithCoordinates = enhancedLandmarks.filter(landmark => landmark.coordinates[0] !== 0 && landmark.coordinates[1] !== 0).length;
    const qualityPercentage = (landmarksWithCoordinates / totalLandmarks) * 100;

    tourLogger.log(`📊 Tour Quality: ${qualityPercentage.toFixed(2)}% (Coordinates found for ${landmarksWithCoordinates} out of ${totalLandmarks} landmarks)`);

    // Log final resilience report
    const finalHealth = DegradationManager.getSystemHealth();
    tourLogger.log(`\n🛡️ Resilience Report:`);
    tourLogger.log(`📊 Degradation Level: ${finalHealth.level} (${finalHealth.policy.name})`);
    tourLogger.log(`🔧 Services Health: ${finalHealth.services.filter(s => s.isHealthy).length}/${finalHealth.services.length} healthy`);
    tourLogger.log(`📦 Cache Entries: ${finalHealth.cacheSize}`);
    
    const circuitMetrics = CircuitBreakerRegistry.getAllMetrics();
    Object.entries(circuitMetrics).forEach(([service, metrics]) => {
      tourLogger.log(`🔌 ${service}: ${metrics.state} (${metrics.totalCalls} calls, ${(metrics.failureRate * 100).toFixed(1)}% failure rate)`);
    });

    // Generate response with system prompt for frontend compatibility
    const systemPrompt = `You are an expert tour guide for ${city}. You have extensive knowledge about the landmarks: ${enhancedLandmarks.map(l => l.name).join(', ')}. Provide helpful, engaging information about these locations and assist visitors with directions, historical context, and travel tips.`;

    const responseData = {
      city,
      systemPrompt,
      tourDescription,
      landmarks: enhancedLandmarks,
      quality: qualityPercentage.toFixed(2),
      logs: tourLogger.getLogs(),
      metadata: {
        totalLandmarks,
        coordinateQuality: {
          highConfidence: enhancedLandmarks.filter(l => l.confidence === 'high').length,
          mediumConfidence: enhancedLandmarks.filter(l => l.confidence === 'medium').length,
          lowConfidence: enhancedLandmarks.filter(l => l.confidence === 'low').length,
        },
        processingTime: Date.now(),
        fallbacksUsed: enhancedLandmarks.map(l => l.coordinateSource).filter(s => s.includes('fallback'))
      },
      resilience: {
        degradationLevel: finalHealth.level,
        circuitBreakerStates: CircuitBreakerRegistry.getAllMetrics()
      }
    };

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Enhanced tour generation failed:', error);
    
    // Log circuit breaker states on failure
    const metrics = CircuitBreakerRegistry.getAllMetrics();
    console.error('🔌 Circuit Breaker States on Failure:', metrics);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate enhanced tour with resilience',
        details: error.message,
        degradationLevel: DegradationManager.getCurrentPolicy().level,
        circuitBreakerStates: metrics
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
