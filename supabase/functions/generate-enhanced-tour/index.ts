import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Landmark {
  name: string;
  coordinates: [number, number];
  description: string;
}

interface EnhancedLandmark extends Landmark {
  placeId?: string;
  coordinateSource?: string;
  confidence?: string;
  rating?: number;
  photos?: any;
  types?: string[];
  formattedAddress?: string;
}

interface CoordinateQuality {
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
}

interface Metadata {
  totalLandmarks: number;
  coordinateQuality: CoordinateQuality;
  processingTime: number;
  fallbacksUsed: string[];
}

interface TourData {
  landmarks: EnhancedLandmark[];
  systemPrompt: string;
  metadata?: Metadata;
}

const SYSTEM_PROMPT_TEMPLATE = `You are an expert local tour guide. A user is planning a trip to {destination}. Suggest a list of interesting and diverse landmarks to visit.
The list should include the name, a short description, and coordinates (latitude and longitude).
Respond in JSON format. Here is an example:
\`\`\`json
{
  "landmarks": [
    {
      "name": "Landmark Name",
      "description": "Short description of the landmark",
      "coordinates": [latitude, longitude]
    }
  ]
}
\`\`\`
The list should be diverse, and include a mix of popular and less well-known attractions. Prioritize landmarks that are unique to {destination}.
Do not include any preamble or postamble in your response. Only respond with valid JSON.
`;

const DESTINATION_VALIDATION_PROMPT = `You are a world class travel expert. A user is planning a trip to a destination.
Your job is to validate that the destination is a real place.
Respond in JSON format. Here is an example:
\`\`\`json
{
  "isValid": true,
  "reason": "Destination is a real place"
}
\`\`\`
If the destination is not a real place, respond with isValid: false and a reason why.
Do not include any preamble or postamble in your response. Only respond with valid JSON.`;

const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

if (!GOOGLE_AI_API_KEY) {
  console.warn("GOOGLE_AI_API_KEY is not set. Calls to the Google AI API will fail.");
}

if (!GOOGLE_API_KEY) {
  console.warn("GOOGLE_API_KEY is not set. Calls to the Google Maps API will fail.");
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Supabase URL or Anon key is not set. Calls to the Supabase API will fail.");
}

async function validateDestination(destination: string): Promise<{ isValid: boolean; reason: string }> {
  if (!GOOGLE_AI_API_KEY) {
    console.warn("GOOGLE_AI_API_KEY is not set. Skipping destination validation.");
    return { isValid: true, reason: "GOOGLE_AI_API_KEY is not set. Skipping destination validation." };
  }

  const prompt = DESTINATION_VALIDATION_PROMPT.replace('{destination}', destination);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_AI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.0,
        }
      }),
    });

    if (!response.ok) {
      console.error('Destination validation failed:', response.status, response.statusText);
      return { isValid: true, reason: `Destination validation failed: ${response.status} ${response.statusText}` };
    }

    const data = await response.json();
    const validationResult = JSON.parse(data.candidates[0].content.parts[0].text);
    return validationResult;
  } catch (error) {
    console.error('Error validating destination:', error);
    return { isValid: true, reason: `Error validating destination: ${error}` };
  }
}

async function generateLandmarkSuggestions(destination: string): Promise<TourData> {
  if (!GOOGLE_AI_API_KEY) {
    throw new Error("GOOGLE_AI_API_KEY is not set.");
  }

  const prompt = SYSTEM_PROMPT_TEMPLATE.replace('{destination}', destination);
  console.log("System Prompt:", prompt);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GOOGLE_AI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.0,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Google AI API request failed with status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const tourData = JSON.parse(data.candidates[0].content.parts[0].text);
    const systemPrompt = prompt;
    return { ...tourData, systemPrompt };
  } catch (error) {
    console.error('Error generating landmark suggestions:', error);
    throw new Error(`Failed to generate landmark suggestions: ${error}`);
  }
}

async function refineCoordinates(landmark: Landmark, attempt = 0, fallbacksUsed: string[] = []): Promise<EnhancedLandmark> {
  if (!GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not set.");
  }

  const maxAttempts = 3;
  const baseQuery = `${landmark.name} in ${landmark.description}`;
  let query = baseQuery;

  // Retry logic with simplified queries
  if (attempt > 0) {
    if (attempt === 1) {
      query = landmark.name; // First fallback: landmark name only
      fallbacksUsed.push("Landmark name only");
    } else if (attempt === 2) {
      query = `${landmark.name} ${landmark.description.split(' ').slice(0, 3).join(' ')}`; // Second fallback: first 3 words of description
      fallbacksUsed.push("First 3 words of description");
    }
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,photos,formatted_address,name,rating,geometry,types&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Google Maps API request failed with status ${response.status}: ${response.statusText}`);
      if (attempt < maxAttempts - 1) {
        console.log(`Retrying coordinate refinement (attempt ${attempt + 1}) for "${landmark.name}" with simplified query.`);
        return refineCoordinates(landmark, attempt + 1, fallbacksUsed); // Recursive call with attempt incremented
      } else {
        console.warn(`Max attempts reached for coordinate refinement of "${landmark.name}". Returning original coordinates.`);
        return { ...landmark, coordinateSource: "original", confidence: "low" };
      }
    }

    const data: any = await response.json();

    if (data.status === 'OK' && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      const enhancedLandmark: EnhancedLandmark = {
        ...landmark,
        placeId: candidate.place_id,
        coordinates: [candidate.geometry.location.lat, candidate.geometry.location.lng],
        coordinateSource: "Google Places API",
        confidence: "high",
        rating: candidate.rating || null,
        photos: candidate.photos || null,
        types: candidate.types || [],
        formattedAddress: candidate.formatted_address
      };
      return enhancedLandmark;
    } else {
      if (data.status === 'ZERO_RESULTS' || data.status === 'NOT_FOUND') {
        console.warn(`No results found for "${landmark.name}" using query "${query}".`);
        if (attempt < maxAttempts - 1) {
          console.log(`Retrying coordinate refinement (attempt ${attempt + 1}) for "${landmark.name}" with simplified query.`);
          return refineCoordinates(landmark, attempt + 1, fallbacksUsed); // Recursive call with attempt incremented
        } else {
          console.warn(`Max attempts reached for coordinate refinement of "${landmark.name}". Returning original coordinates.`);
          return { ...landmark, coordinateSource: "original", confidence: "low" };
        }
      } else {
        console.error(`Unexpected status from Google Maps API: ${data.status}`);
        return { ...landmark, coordinateSource: "original", confidence: "low" };
      }
    }
  } catch (error) {
    console.error('Error refining coordinates:', error);
    if (attempt < maxAttempts - 1) {
      console.log(`Retrying coordinate refinement (attempt ${attempt + 1}) for "${landmark.name}" after error.`);
      return refineCoordinates(landmark, attempt + 1, fallbacksUsed); // Recursive call with attempt incremented
    } else {
      console.warn(`Max attempts reached for coordinate refinement of "${landmark.name}" after error. Returning original coordinates.`);
      return { ...landmark, coordinateSource: "original", confidence: "low" };
    }
  }
}

function calculateCoordinateQuality(landmarks: EnhancedLandmark[]): CoordinateQuality {
  const coordinateQuality: CoordinateQuality = {
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
  };

  landmarks.forEach(landmark => {
    if (landmark.confidence === "high") {
      coordinateQuality.highConfidence++;
    } else if (landmark.confidence === "medium") {
      coordinateQuality.mediumConfidence++;
    } else {
      coordinateQuality.lowConfidence++;
    }
  });

  return coordinateQuality;
}

async function storeTourData(supabase: any, tourData: any, processingMetrics: any) {
  try {
    console.log('📊 Storing tour data to database...');
    
    const tourRecord = {
      user_id: tourData.userId,
      destination: tourData.destination,
      system_prompt: tourData.systemPrompt,
      total_landmarks: tourData.landmarks?.length || 0,
      generation_start_time: processingMetrics.startTime,
      generation_end_time: new Date().toISOString(),
      total_processing_time_ms: processingMetrics.totalTime,
      coordinate_quality_high: processingMetrics.coordinateQuality?.highConfidence || 0,
      coordinate_quality_medium: processingMetrics.coordinateQuality?.mediumConfidence || 0,
      coordinate_quality_low: processingMetrics.coordinateQuality?.lowConfidence || 0,
      gemini_api_calls: processingMetrics.geminiApiCalls || 1,
      places_api_calls: processingMetrics.placesApiCalls || 0,
      success_rate: processingMetrics.successRate || 1.0,
      error_count: processingMetrics.errorCount || 0,
      fallbacks_used: processingMetrics.fallbacksUsed || []
    };

    const { data, error } = await supabase
      .from('generated_tours')
      .insert(tourRecord)
      .select()
      .single();

    if (error) {
      console.error('❌ Error storing tour data:', error);
      return null;
    }

    console.log('✅ Tour data stored successfully:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Exception storing tour data:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destination } = await req.json();
    
    if (!destination) {
      throw new Error("Destination is required");
    }

    console.log(`🚀 Enhanced tour generation started for: ${destination}`);
    const startTime = new Date().toISOString();
    const processingStart = Date.now();

    // API key validation
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Supabase URL and Anon key are required");
    }

    // Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false
      }
    });

    // Destination validation
    const validationResult = await validateDestination(destination);
    if (!validationResult.isValid) {
      throw new Error(`Invalid destination: ${validationResult.reason}`);
    }

    // Generate landmark suggestions
    const tourData = await generateLandmarkSuggestions(destination);
    const landmarks = tourData.landmarks;
    const systemPrompt = tourData.systemPrompt;

    // Refine coordinates for each landmark
    const enhancedLandmarks: EnhancedLandmark[] = [];
    const fallbacksUsed: string[] = [];
    for (const landmark of landmarks) {
      const enhancedLandmark = await refineCoordinates(landmark);
      enhancedLandmarks.push(enhancedLandmark);
      if (enhancedLandmark.coordinateSource === "original") {
        fallbacksUsed.push(landmark.name);
      }
    }

    // Calculate coordinate quality
    const coordinateQuality = calculateCoordinateQuality(enhancedLandmarks);

    const metadata: Metadata = {
      totalLandmarks: enhancedLandmarks.length,
      coordinateQuality: coordinateQuality,
      processingTime: Date.now() - processingStart,
      fallbacksUsed: fallbacksUsed
    };

    // Before returning the response, prepare data for background storage
    const processingMetrics = {
      startTime,
      totalTime: Date.now() - processingStart,
      coordinateQuality: metadata?.coordinateQuality,
      geminiApiCalls: 1, // We make one call to Gemini
      placesApiCalls: enhancedLandmarks?.length || 0, // One call per landmark
      successRate: enhancedLandmarks?.length > 0 ? 1.0 : 0.0,
      errorCount: 0,
      fallbacksUsed: metadata?.fallbacksUsed || []
    };

    // Get user ID from auth header for storage
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id;
      } catch (authError) {
        console.log('Could not get user for storage, continuing without user tracking');
      }
    }

    // Store tour data in background (non-blocking)
    if (userId && enhancedLandmarks?.length > 0) {
      EdgeRuntime.waitUntil(
        storeTourData(supabase, {
          userId,
          destination,
          systemPrompt,
          landmarks: enhancedLandmarks
        }, processingMetrics)
      );
    }

    return new Response(JSON.stringify({
      landmarks: enhancedLandmarks,
      systemPrompt,
      metadata
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("❌ Enhanced tour generation error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to generate enhanced tour"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
