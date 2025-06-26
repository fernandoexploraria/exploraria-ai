
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface LandmarkFromGemini {
  name: string;
  alternativeNames?: string[];
  description: string;
  category?: string;
}

interface EnhancedLandmark {
  id: string;
  name: string;
  coordinates: [number, number];
  description: string;
  placeId?: string;
  coordinateSource: 'places' | 'geocoding' | 'gemini';
  confidence: number;
  rating?: number;
  photos?: string[];
  types?: string[];
  formattedAddress?: string;
}

interface EnhancedTourResponse {
  landmarks: EnhancedLandmark[];
  systemPrompt: string;
  destination: string;
  metadata: {
    totalLandmarks: number;
    coordinateQuality: {
      highConfidence: number;
      mediumConfidence: number;
      lowConfidence: number;
    };
    processingTime: number;
    fallbacksUsed: string[];
  };
}

// Helper function to get city center coordinates
const getCityCenterCoordinates = async (destination: string, googleApiKey: string): Promise<[number, number] | null> => {
  try {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination)}&key=${googleApiKey}`;
    const response = await fetch(geocodeUrl);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return [location.lng, location.lat];
    }
  } catch (error) {
    console.error('Error getting city center:', error);
  }
  return null;
};

// Helper function to calculate distance between coordinates
const calculateDistance = (coord1: [number, number], coord2: [number, number]): number => {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Layer 1: Google Places Text Search
const searchPlacesByText = async (searchQuery: string, googleApiKey: string) => {
  try {
    const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.photos,places.location'
      },
      body: JSON.stringify({
        textQuery: searchQuery,
        maxResultCount: 5
      })
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.places || [];
  } catch (error) {
    console.error('Places text search error:', error);
    return null;
  }
};

// Layer 4: Google Geocoding API
const geocodeLandmark = async (address: string, googleApiKey: string) => {
  try {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleApiKey}`;
    const response = await fetch(geocodeUrl);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        coordinates: [result.geometry.location.lng, result.geometry.location.lat] as [number, number],
        formattedAddress: result.formatted_address
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
};

// Layer 5: Gemini coordinates fallback
const getGeminiCoordinates = async (landmarkName: string, destination: string, googleAiApiKey: string) => {
  try {
    const prompt = `Provide only the coordinates for "${landmarkName}" in ${destination}. Respond with only a JSON object: {"coordinates": [longitude, latitude]}`;
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleAiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 100 }
        })
      }
    );

    if (!response.ok) return null;
    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (responseText) {
      const cleanedJson = responseText.replace(/```json\n|```/g, '').trim();
      const parsed = JSON.parse(cleanedJson);
      return parsed.coordinates as [number, number];
    }
  } catch (error) {
    console.error('Gemini coordinates fallback error:', error);
  }
  return null;
};

// Multi-layered coordinate refinement
const refineCoordinates = async (
  landmark: LandmarkFromGemini, 
  destination: string, 
  cityCenter: [number, number] | null,
  googleApiKey: string,
  googleAiApiKey: string
): Promise<EnhancedLandmark> => {
  const fallbacksUsed: string[] = [];
  let coordinates: [number, number] | null = null;
  let coordinateSource: 'places' | 'geocoding' | 'gemini' = 'gemini';
  let confidence = 0;
  let placeId: string | undefined;
  let rating: number | undefined;
  let photos: string[] | undefined;
  let types: string[] | undefined;
  let formattedAddress: string | undefined;

  // Layer 1: Primary text search
  console.log(`🔍 Layer 1: Searching for "${landmark.name}" in ${destination}`);
  const primarySearch = await searchPlacesByText(`${landmark.name} ${destination}`, googleApiKey);
  
  if (primarySearch && primarySearch.length > 0) {
    const place = primarySearch[0];
    if (place.location) {
      coordinates = [place.location.longitude, place.location.latitude];
      coordinateSource = 'places';
      confidence = 0.9;
      placeId = place.id;
      rating = place.rating;
      types = place.types;
      formattedAddress = place.formattedAddress;
      
      if (place.photos && place.photos.length > 0) {
        photos = place.photos.slice(0, 3).map((photo: any) => 
          `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=600&key=${googleApiKey}`
        );
      }
      
      console.log(`✅ Layer 1 success: Found via primary search`);
    }
  }

  // Layer 2: Alternative name search
  if (!coordinates && landmark.alternativeNames) {
    for (const altName of landmark.alternativeNames) {
      console.log(`🔍 Layer 2: Trying alternative name "${altName}"`);
      const altSearch = await searchPlacesByText(`${altName} ${destination}`, googleApiKey);
      
      if (altSearch && altSearch.length > 0) {
        const place = altSearch[0];
        if (place.location) {
          coordinates = [place.location.longitude, place.location.latitude];
          coordinateSource = 'places';
          confidence = 0.8;
          placeId = place.id;
          rating = place.rating;
          types = place.types;
          formattedAddress = place.formattedAddress;
          
          if (place.photos && place.photos.length > 0) {
            photos = place.photos.slice(0, 3).map((photo: any) => 
              `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=600&key=${googleApiKey}`
            );
          }
          
          fallbacksUsed.push('alternative_names');
          console.log(`✅ Layer 2 success: Found via alternative name "${altName}"`);
          break;
        }
      }
    }
  }

  // Layer 4: Geocoding API (skipping Layer 3 nearby search for now)
  if (!coordinates) {
    console.log(`🔍 Layer 4: Geocoding "${landmark.name}, ${destination}"`);
    const geocoded = await geocodeLandmark(`${landmark.name}, ${destination}`, googleApiKey);
    
    if (geocoded) {
      coordinates = geocoded.coordinates;
      coordinateSource = 'geocoding';
      confidence = 0.6;
      formattedAddress = geocoded.formattedAddress;
      fallbacksUsed.push('geocoding');
      console.log(`✅ Layer 4 success: Found via geocoding`);
    }
  }

  // Layer 5: Gemini fallback
  if (!coordinates) {
    console.log(`🔍 Layer 5: Gemini fallback for "${landmark.name}"`);
    const geminiCoords = await getGeminiCoordinates(landmark.name, destination, googleAiApiKey);
    
    if (geminiCoords) {
      coordinates = geminiCoords;
      coordinateSource = 'gemini';
      confidence = 0.3;
      fallbacksUsed.push('gemini_coordinates');
      console.log(`✅ Layer 5 success: Gemini provided coordinates`);
    }
  }

  // Final fallback - use default coordinates if all else fails
  if (!coordinates) {
    console.log(`❌ All layers failed for "${landmark.name}", using default coordinates`);
    coordinates = [0, 0]; // Default coordinates
    confidence = 0.1;
    fallbacksUsed.push('default');
  }

  // Validate coordinates are within reasonable bounds
  if (cityCenter && coordinates) {
    const distance = calculateDistance(coordinates, cityCenter);
    if (distance > 100) { // More than 100km from city center
      console.log(`⚠️ Coordinates for "${landmark.name}" seem too far from city center (${distance}km)`);
      confidence = Math.max(0.1, confidence - 0.3);
    }
  }

  return {
    id: `tour-landmark-${crypto.randomUUID()}`,
    name: landmark.name,
    coordinates,
    description: landmark.description,
    placeId,
    coordinateSource,
    confidence,
    rating,
    photos,
    types,
    formattedAddress
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const { destination } = await req.json();
    const startTime = Date.now();
    
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    const googleAiApiKey = Deno.env.get('GOOGLE_AI_API_KEY');
    
    if (!googleApiKey || !googleAiApiKey) {
      throw new Error('Required API keys not configured');
    }

    console.log(`🚀 Starting enhanced tour generation for: ${destination}`);

    // Step 1: Get city center coordinates
    const cityCenter = await getCityCenterCoordinates(destination, googleApiKey);
    console.log(`📍 City center coordinates:`, cityCenter);

    // Step 2: Modified Gemini prompt - no coordinates requested
    const systemInstruction = `You are an expert tour planner. Your response MUST be a valid JSON object with exactly this structure:
    {
      "landmarks": [array of landmark objects],
      "systemPrompt": "string containing the ElevenLabs assistant system prompt"
    }
    
    Do not include any text before or after the JSON object.
    Each landmark object should have: {
      "name": "string", 
      "alternativeNames": ["array of alternative names"],
      "description": "string",
      "category": "string like museum, monument, park, etc"
    }
    
    Do NOT include coordinates - they will be determined separately.`;

    const prompt = `Create a comprehensive tour plan for ${destination} that includes:

    1. A list of the top 10 most famous landmarks with their names, alternative names, descriptions, and categories
    2. A detailed system prompt for an AI tour guide assistant

    For each landmark, provide:
    - The official name
    - Alternative names (local names, common nicknames, translations)
    - A detailed description
    - The category (museum, monument, park, religious, architectural, etc.)

    The system prompt should make the AI assistant an expert on ${destination} with deep knowledge about the landmarks, history, culture, and practical tips.
    
    Format the response as a JSON object with "landmarks" and "systemPrompt" fields.`;

    console.log('🤖 Calling Gemini for landmark names and descriptions...');
    
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleAiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemInstruction + '\n\n' + prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
        })
      }
    );

    if (!geminiResponse.ok) {
      throw new Error('Failed to get response from Gemini API');
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      throw new Error('Invalid response from Gemini API');
    }

    console.log('📝 Got Gemini response, parsing...');
    const cleanedJson = responseText.replace(/```json\n|```/g, '').trim();
    const tourData = JSON.parse(cleanedJson);

    if (!tourData.landmarks || !tourData.systemPrompt) {
      throw new Error('Invalid tour data structure received from Gemini');
    }

    console.log(`🔍 Refining coordinates for ${tourData.landmarks.length} landmarks...`);

    // Step 3: Refine coordinates for each landmark
    const fallbacksUsed: string[] = [];
    const enhancedLandmarks: EnhancedLandmark[] = [];

    for (const landmark of tourData.landmarks) {
      console.log(`\n🏛️ Processing: ${landmark.name}`);
      const enhanced = await refineCoordinates(
        landmark, 
        destination, 
        cityCenter, 
        googleApiKey, 
        googleAiApiKey
      );
      enhancedLandmarks.push(enhanced);
    }

    // Step 4: Calculate quality metrics
    const coordinateQuality = enhancedLandmarks.reduce(
      (acc, landmark) => {
        if (landmark.confidence >= 0.8) acc.highConfidence++;
        else if (landmark.confidence >= 0.5) acc.mediumConfidence++;
        else acc.lowConfidence++;
        return acc;
      },
      { highConfidence: 0, mediumConfidence: 0, lowConfidence: 0 }
    );

    const processingTime = Date.now() - startTime;

    const response: EnhancedTourResponse = {
      landmarks: enhancedLandmarks,
      systemPrompt: tourData.systemPrompt,
      destination,
      metadata: {
        totalLandmarks: enhancedLandmarks.length,
        coordinateQuality,
        processingTime,
        fallbacksUsed: [...new Set(fallbacksUsed)]
      }
    };

    console.log(`✅ Enhanced tour generation completed in ${processingTime}ms`);
    console.log(`📊 Quality: ${coordinateQuality.highConfidence} high, ${coordinateQuality.mediumConfidence} medium, ${coordinateQuality.lowConfidence} low confidence`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in generate-enhanced-tour:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate enhanced tour',
      details: error.message 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
