
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
    searchStats: {
      totalSearches: number;
      successfulSearches: number;
      searchStrategies: { [key: string]: number };
    };
  };
}

interface GeographicContext {
  city: string;
  state?: string;
  country: string;
  region?: string;
  administrativeAreas: string[];
}

interface SearchQuery {
  query: string;
  strategy: string;
  priority: number;
}

// Enhanced geographic context extraction
const extractGeographicContext = async (destination: string, googleApiKey: string): Promise<GeographicContext> => {
  try {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination)}&key=${googleApiKey}`;
    const response = await fetch(geocodeUrl);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      const components = result.address_components;
      
      let city = destination;
      let state: string | undefined;
      let country = '';
      let region: string | undefined;
      const administrativeAreas: string[] = [];
      
      for (const component of components) {
        const types = component.types;
        
        if (types.includes('locality') || types.includes('administrative_area_level_2')) {
          city = component.long_name;
        } else if (types.includes('administrative_area_level_1')) {
          state = component.long_name;
          administrativeAreas.push(component.long_name);
        } else if (types.includes('country')) {
          country = component.long_name;
        } else if (types.includes('sublocality') || types.includes('administrative_area_level_3')) {
          region = component.long_name;
          administrativeAreas.push(component.long_name);
        }
      }
      
      return { city, state, country, region, administrativeAreas };
    }
  } catch (error) {
    console.error('Geographic context extraction error:', error);
  }
  
  // Fallback context
  return {
    city: destination,
    country: '',
    administrativeAreas: []
  };
};

// Smart search term generation
const generateSearchQueries = (landmark: LandmarkFromGemini, geoContext: GeographicContext): SearchQuery[] => {
  const queries: SearchQuery[] = [];
  const landmarkName = landmark.name;
  const category = landmark.category || '';
  
  // Strategy 1: Exact name + full location hierarchy (highest priority)
  if (geoContext.state && geoContext.country) {
    queries.push({
      query: `${landmarkName} ${geoContext.city} ${geoContext.state} ${geoContext.country}`,
      strategy: 'exact_full_hierarchy',
      priority: 10
    });
  }
  
  queries.push({
    query: `${landmarkName} ${geoContext.city} ${geoContext.country}`,
    strategy: 'exact_city_country',
    priority: 9
  });
  
  // Strategy 2: Category-enhanced searches
  if (category) {
    queries.push({
      query: `${landmarkName} ${category} ${geoContext.city}`,
      strategy: 'category_enhanced',
      priority: 8
    });
    
    queries.push({
      query: `${category} ${landmarkName} in ${geoContext.city}`,
      strategy: 'category_natural_language',
      priority: 7
    });
  }
  
  // Strategy 3: Alternative names with full context
  if (landmark.alternativeNames) {
    landmark.alternativeNames.forEach((altName, index) => {
      queries.push({
        query: `${altName} ${geoContext.city} ${geoContext.country}`,
        strategy: `alternative_name_${index + 1}`,
        priority: 6 - index * 0.5
      });
    });
  }
  
  // Strategy 4: Regional context searches
  if (geoContext.region) {
    queries.push({
      query: `${landmarkName} ${geoContext.region} ${geoContext.city}`,
      strategy: 'regional_context',
      priority: 6
    });
  }
  
  // Strategy 5: Administrative area searches
  geoContext.administrativeAreas.forEach((area, index) => {
    queries.push({
      query: `${landmarkName} ${area}`,
      strategy: `administrative_area_${index + 1}`,
      priority: 5 - index * 0.2
    });
  });
  
  // Strategy 6: Simplified searches (fallback)
  queries.push({
    query: `${landmarkName} ${geoContext.city}`,
    strategy: 'simple_city',
    priority: 4
  });
  
  queries.push({
    query: landmarkName,
    strategy: 'name_only',
    priority: 2
  });
  
  // Strategy 7: Multilingual variations (if landmark name contains non-Latin characters)
  if (/[^\x00-\x7F]/.test(landmarkName)) {
    queries.push({
      query: `${landmarkName} landmark ${geoContext.city}`,
      strategy: 'multilingual_landmark',
      priority: 5
    });
  }
  
  // Sort by priority (highest first) and return top 8 queries
  return queries
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8);
};

// Enhanced Places Text Search with multiple query attempts
const searchPlacesWithStrategies = async (searchQueries: SearchQuery[], googleApiKey: string) => {
  const searchStats = {
    totalSearches: 0,
    successfulSearches: 0,
    searchStrategies: {} as { [key: string]: number }
  };
  
  for (const searchQuery of searchQueries) {
    try {
      console.log(`🔍 Trying ${searchQuery.strategy}: "${searchQuery.query}"`);
      
      searchStats.totalSearches++;
      searchStats.searchStrategies[searchQuery.strategy] = (searchStats.searchStrategies[searchQuery.strategy] || 0) + 1;
      
      const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleApiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.photos,places.location'
        },
        body: JSON.stringify({
          textQuery: searchQuery.query,
          maxResultCount: 5
        })
      });

      if (!response.ok) continue;
      
      const data = await response.json();
      if (data.places && data.places.length > 0) {
        console.log(`✅ ${searchQuery.strategy} success: Found ${data.places.length} results`);
        searchStats.successfulSearches++;
        return { places: data.places, strategy: searchQuery.strategy, searchStats };
      }
    } catch (error) {
      console.error(`Search strategy ${searchQuery.strategy} failed:`, error);
    }
  }
  
  return { places: null, strategy: 'none', searchStats };
};

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

// Enhanced coordinate refinement with smart search
const refineCoordinates = async (
  landmark: LandmarkFromGemini, 
  geoContext: GeographicContext,
  cityCenter: [number, number] | null,
  googleApiKey: string,
  googleAiApiKey: string
): Promise<{ enhancedLandmark: EnhancedLandmark; searchStats: any }> => {
  const fallbacksUsed: string[] = [];
  let coordinates: [number, number] | null = null;
  let coordinateSource: 'places' | 'geocoding' | 'gemini' = 'gemini';
  let confidence = 0;
  let placeId: string | undefined;
  let rating: number | undefined;
  let photos: string[] | undefined;
  let types: string[] | undefined;
  let formattedAddress: string | undefined;
  let usedStrategy = 'none';
  let searchStats = {
    totalSearches: 0,
    successfulSearches: 0,
    searchStrategies: {} as { [key: string]: number }
  };

  // Generate smart search queries
  const searchQueries = generateSearchQueries(landmark, geoContext);
  console.log(`🔍 Generated ${searchQueries.length} search strategies for "${landmark.name}"`);

  // Layer 1: Enhanced Places search with multiple strategies
  const placesResult = await searchPlacesWithStrategies(searchQueries, googleApiKey);
  searchStats = placesResult.searchStats;
  
  if (placesResult.places && placesResult.places.length > 0) {
    const place = placesResult.places[0];
    usedStrategy = placesResult.strategy;
    
    if (place.location) {
      coordinates = [place.location.longitude, place.location.latitude];
      coordinateSource = 'places';
      
      // Enhanced confidence scoring based on strategy used
      const strategyConfidence = {
        'exact_full_hierarchy': 0.95,
        'exact_city_country': 0.9,
        'category_enhanced': 0.85,
        'category_natural_language': 0.8,
        'alternative_name_1': 0.8,
        'regional_context': 0.75,
        'simple_city': 0.7,
        'multilingual_landmark': 0.75
      };
      
      confidence = strategyConfidence[usedStrategy as keyof typeof strategyConfidence] || 0.6;
      
      placeId = place.id;
      rating = place.rating;
      types = place.types;
      formattedAddress = place.formattedAddress;
      
      if (place.photos && place.photos.length > 0) {
        photos = place.photos.slice(0, 3).map((photo: any) => 
          `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=600&key=${googleApiKey}`
        );
      }
      
      console.log(`✅ Enhanced Places search success using strategy: ${usedStrategy}`);
    }
  }

  // Layer 2: Enhanced geocoding with geographic context
  if (!coordinates) {
    console.log(`🔍 Trying enhanced geocoding for "${landmark.name}"`);
    
    const geocodingQueries = [
      `${landmark.name}, ${geoContext.city}, ${geoContext.country}`,
      `${landmark.name}, ${geoContext.city}`,
      landmark.name
    ];
    
    for (const query of geocodingQueries) {
      const geocoded = await geocodeLandmark(query, googleApiKey);
      searchStats.totalSearches++;
      searchStats.searchStrategies['geocoding'] = (searchStats.searchStrategies['geocoding'] || 0) + 1;
      
      if (geocoded) {
        coordinates = geocoded.coordinates;
        coordinateSource = 'geocoding';
        confidence = 0.6;
        formattedAddress = geocoded.formattedAddress;
        fallbacksUsed.push('enhanced_geocoding');
        searchStats.successfulSearches++;
        console.log(`✅ Enhanced geocoding success with query: ${query}`);
        break;
      }
    }
  }

  // Layer 3: Gemini fallback with enhanced context
  if (!coordinates) {
    console.log(`🔍 Gemini fallback for "${landmark.name}"`);
    const contextualPrompt = `${landmark.name} in ${geoContext.city}, ${geoContext.country}`;
    const geminiCoords = await getGeminiCoordinates(contextualPrompt, geoContext.city, googleAiApiKey);
    searchStats.totalSearches++;
    searchStats.searchStrategies['gemini'] = (searchStats.searchStrategies['gemini'] || 0) + 1;
    
    if (geminiCoords) {
      coordinates = geminiCoords;
      coordinateSource = 'gemini';
      confidence = 0.3;
      fallbacksUsed.push('gemini_coordinates');
      searchStats.successfulSearches++;
      console.log(`✅ Gemini fallback success`);
    }
  }

  // Final fallback
  if (!coordinates) {
    console.log(`❌ All enhanced strategies failed for "${landmark.name}", using default coordinates`);
    coordinates = [0, 0];
    confidence = 0.1;
    fallbacksUsed.push('default');
  }

  // Enhanced geographic validation
  if (cityCenter && coordinates) {
    const distance = calculateDistance(coordinates, cityCenter);
    if (distance > 100) {
      console.log(`⚠️ Coordinates for "${landmark.name}" seem too far from city center (${distance}km)`);
      confidence = Math.max(0.1, confidence - 0.3);
    } else if (distance > 50) {
      confidence = Math.max(0.1, confidence - 0.1);
    }
  }

  const enhancedLandmark: EnhancedLandmark = {
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

  return { enhancedLandmark, searchStats };
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

    // Step 1: Extract enhanced geographic context
    const geoContext = await extractGeographicContext(destination, googleApiKey);
    console.log(`📍 Geographic context:`, geoContext);

    // Step 2: Get city center coordinates
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

    console.log(`🔍 Refining coordinates for ${tourData.landmarks.length} landmarks with enhanced search...`);

    // Step 4: Enhanced coordinate refinement
    const fallbacksUsed: string[] = [];
    const enhancedLandmarks: EnhancedLandmark[] = [];
    const aggregatedSearchStats = {
      totalSearches: 0,
      successfulSearches: 0,
      searchStrategies: {} as { [key: string]: number }
    };

    for (const landmark of tourData.landmarks) {
      console.log(`\n🏛️ Processing: ${landmark.name}`);
      const { enhancedLandmark, searchStats } = await refineCoordinates(
        landmark, 
        geoContext,
        cityCenter, 
        googleApiKey, 
        googleAiApiKey
      );
      
      enhancedLandmarks.push(enhancedLandmark);
      
      // Aggregate search statistics
      aggregatedSearchStats.totalSearches += searchStats.totalSearches;
      aggregatedSearchStats.successfulSearches += searchStats.successfulSearches;
      
      Object.entries(searchStats.searchStrategies).forEach(([strategy, count]) => {
        aggregatedSearchStats.searchStrategies[strategy] = 
          (aggregatedSearchStats.searchStrategies[strategy] || 0) + count;
      });
    }

    // Step 5: Calculate quality metrics
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
        fallbacksUsed: [...new Set(fallbacksUsed)],
        searchStats: aggregatedSearchStats
      }
    };

    console.log(`✅ Enhanced tour generation completed in ${processingTime}ms`);
    console.log(`📊 Quality: ${coordinateQuality.highConfidence} high, ${coordinateQuality.mediumConfidence} medium, ${coordinateQuality.lowConfidence} low confidence`);
    console.log(`🔍 Search stats: ${aggregatedSearchStats.successfulSearches}/${aggregatedSearchStats.totalSearches} successful searches`);

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
