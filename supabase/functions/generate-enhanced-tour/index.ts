import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Reusable function to validate and parse Geocoding API responses
function validateGeocodingResponse(data: any, context: string = "Geocoding API") {
  console.log(`🗺️ ${context} - Raw response status:`, data?.status);
  
  if (!data || !data.status) {
    throw new Error(`${context}: Invalid response - missing status field`);
  }

  if (data.status === "OK") {
    if (!Array.isArray(data.results) || data.results.length === 0) {
      throw new Error(`${context}: OK status but no results available`);
    }
    
    const result = data.results[0];
    
    // Validate essential geometry and location data
    if (!result.geometry || !result.geometry.location ||
        typeof result.geometry.location.lat !== 'number' ||
        typeof result.geometry.location.lng !== 'number') {
      throw new Error(`${context}: Missing or invalid geometry.location data`);
    }
    
    console.log(`✅ ${context} - Valid response with coordinates:`, 
      result.geometry.location.lat, result.geometry.location.lng);
    
    return result;
  } else if (data.status === "ZERO_RESULTS") {
    console.log(`📍 ${context} - No results found`);
    return null;
  } else {
    const errorMessage = data.error_message || `API returned status: ${data.status}`;
    console.error(`❌ ${context} - Error:`, data.status, errorMessage);
    
    // Handle specific error types
    if (data.status === "OVER_QUERY_LIMIT") {
      throw new Error(`${context}: Quota exceeded`);
    } else if (data.status === "REQUEST_DENIED") {
      throw new Error(`${context}: Request denied - check API key and permissions`);
    } else if (data.status === "INVALID_REQUEST") {
      throw new Error(`${context}: Invalid request format`);
    } else {
      throw new Error(`${context}: ${errorMessage}`);
    }
  }
}

// Enhanced geocoding function with proper error handling
async function geocodeLandmark(query: string, googleApiKey: string) {
  try {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${googleApiKey}`;
    console.log(`🔍 Geocoding landmark: ${query}`);
    
    const response = await fetch(geocodeUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const result = validateGeocodingResponse(data, "Landmark Geocoding");
    
    if (!result) {
      return null; // No results found
    }
    
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted_address: result.formatted_address || query,
      place_id: result.place_id
    };
  } catch (error) {
    console.error(`❌ Error geocoding landmark "${query}":`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destination, preferences = {} } = await req.json();
    
    if (!destination) {
      return new Response(
        JSON.stringify({ error: 'Destination is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🎯 Starting enhanced tour generation for: ${destination}`);
    console.log(`📋 Preferences:`, preferences);

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    const geminiApiKey = Deno.env.get('GOOGLE_AI_API_KEY');

    if (!googleApiKey || !geminiApiKey) {
      console.error('❌ Missing required API keys');
      return new Response(
        JSON.stringify({ error: 'API keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Phase 1: Get geographic context with enhanced validation
    console.log('🗺️ Phase 1: Getting geographic context...');
    let cityInfo = null;
    let countryInfo = null;
    
    try {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination)}&key=${googleApiKey}`;
      console.log('📍 Geocoding destination for context...');
      
      const response = await fetch(geocodeUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const result = validateGeocodingResponse(data, "Geographic Context");
      
      if (result && result.address_components) {
        // Safely extract city and country information
        for (const component of result.address_components) {
          if (component.types && Array.isArray(component.types)) {
            if (component.types.includes("locality") && !cityInfo) {
              cityInfo = component.long_name;
            }
            if (component.types.includes("country") && !countryInfo) {
              countryInfo = component.long_name;
            }
          }
        }
        console.log(`🏙️ Geographic context - City: ${cityInfo}, Country: ${countryInfo}`);
      }
    } catch (error) {
      console.error('⚠️ Geographic context extraction failed:', error);
      // Continue without geographic context - this is not critical for tour generation
    }

    // Phase 2: Generate comprehensive tour data using Gemini
    console.log('🤖 Phase 2: Generating comprehensive tour with Gemini...');
    
    const tourPrompt = `Generate a comprehensive tour guide for "${destination}". 

    ${cityInfo && countryInfo ? `Geographic context: ${destination} is in ${cityInfo}, ${countryInfo}.` : ''}
    
    User preferences: ${JSON.stringify(preferences)}
    
    Create a detailed tour with exactly 8-12 landmarks/attractions. For each location, provide:
    1. A descriptive name
    2. A brief but engaging description (2-3 sentences)
    3. Historical or cultural significance
    4. Best time to visit
    5. Estimated visit duration
    6. Why it's special or unique
    
    Focus on a mix of must-see famous attractions, hidden gems, and cultural experiences. Include practical information like opening hours when relevant.
    
    Format the response as a JSON object with this structure:
    {
      "tour_title": "Comprehensive Tour of [Destination]",
      "tour_description": "A brief overview of what makes this destination special",
      "total_duration": "X days",
      "best_time_to_visit": "Season/months",
      "landmarks": [
        {
          "name": "Landmark Name",
          "description": "Engaging description with historical context",
          "significance": "Why this place is important",
          "visit_duration": "X hours",
          "best_time": "Morning/Afternoon/Evening",
          "category": "Historical/Cultural/Natural/Religious/Modern"
        }
      ]
    }`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: tourPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4000,
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const tourContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!tourContent) {
      throw new Error('No tour content generated');
    }

    console.log('✅ Tour content generated successfully');

    // Parse the generated tour data
    let tourData;
    try {
      const jsonMatch = tourContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      tourData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('❌ Failed to parse Gemini response as JSON:', parseError);
      // Create fallback tour structure
      tourData = {
        tour_title: `Comprehensive Tour of ${destination}`,
        tour_description: `An amazing journey through the highlights of ${destination}`,
        total_duration: "2-3 days",
        best_time_to_visit: "Year-round",
        landmarks: []
      };
    }

    // Phase 3: Validate coordinates for tour planning
    console.log('📍 Phase 3: Validating destination coordinates...');
    let destinationCoords = null;
    
    try {
      const cityGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination)}&key=${googleApiKey}`;
      console.log('🎯 Getting city center coordinates...');
      
      const cityResponse = await fetch(cityGeocodeUrl);
      if (!cityResponse.ok) {
        throw new Error(`HTTP ${cityResponse.status}: ${cityResponse.statusText}`);
      }
      
      const cityData = await cityResponse.json();
      const cityResult = validateGeocodingResponse(cityData, "City Center Calculation");
      
      if (cityResult) {
        destinationCoords = [
          cityResult.geometry.location.lng,
          cityResult.geometry.location.lat
        ];
        console.log(`📍 Destination coordinates:`, destinationCoords);
        
        // Validate coordinates are plausible (basic sanity check)
        const [lng, lat] = destinationCoords;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          console.error('❌ Invalid coordinate range detected');
          destinationCoords = null;
        } else {
          // Optional: Reverse geocode to validate coordinates are on land
          try {
            const reverseGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleApiKey}`;
            console.log('🔄 Reverse geocoding to validate coordinates...');
            
            const reverseResponse = await fetch(reverseGeocodeUrl);
            if (!reverseResponse.ok) {
              throw new Error(`HTTP ${reverseResponse.status}: ${reverseResponse.statusText}`);
            }
            
            const reverseData = await reverseResponse.json();
            const reverseResult = validateGeocodingResponse(reverseData, "Coordinate Validation");
            
            if (reverseResult) {
              console.log('✅ Coordinates validated successfully');
            } else {
              console.log('⚠️ Coordinates could not be reverse geocoded');
            }
          } catch (reverseError) {
            console.error('⚠️ Reverse geocoding failed (non-critical):', reverseError);
            // Continue with coordinates even if reverse geocoding fails
          }
        }
      }
    } catch (error) {
      console.error('⚠️ City center coordinate calculation failed:', error);
      // Continue without coordinates - the tour can still be generated
    }

    // Phase 4: Enhanced geocoding for landmarks
    console.log('🏛️ Phase 4: Geocoding landmarks...');
    
    if (tourData.landmarks && Array.isArray(tourData.landmarks)) {
      console.log(`📍 Processing ${tourData.landmarks.length} landmarks for geocoding...`);
      
      const geocodingPromises = tourData.landmarks.map(async (landmark, index) => {
        if (!landmark.name) {
          console.warn(`⚠️ Landmark ${index} has no name, skipping geocoding`);
          return { ...landmark, coordinates: null };
        }
        
        const query = `${landmark.name}, ${destination}`;
        console.log(`🔍 Geocoding: ${query}`);
        
        try {
          const geocoded = await geocodeLandmark(query, googleApiKey);
          
          if (geocoded) {
            console.log(`✅ Successfully geocoded: ${landmark.name}`);
            return {
              ...landmark,
              coordinates: [geocoded.lng, geocoded.lat],
              formatted_address: geocoded.formatted_address,
              place_id: geocoded.place_id
            };
          } else {
            console.log(`❌ Could not geocode: ${landmark.name}`);
            return { ...landmark, coordinates: null };
          }
        } catch (error) {
          console.error(`❌ Error geocoding ${landmark.name}:`, error);
          return { ...landmark, coordinates: null };
        }
      });
      
      tourData.landmarks = await Promise.all(geocodingPromises);
      
      const geocodedCount = tourData.landmarks.filter(l => l.coordinates).length;
      console.log(`📊 Geocoding complete: ${geocodedCount}/${tourData.landmarks.length} landmarks geocoded`);
    }

    // Phase 5: Prepare final response
    console.log('📦 Phase 5: Preparing final tour package...');
    
    const enhancedTour = {
      ...tourData,
      destination,
      destination_coordinates: destinationCoords,
      geographic_context: {
        city: cityInfo,
        country: countryInfo
      },
      generation_timestamp: new Date().toISOString(),
      preferences_applied: preferences,
      geocoding_success_rate: tourData.landmarks ? 
        `${tourData.landmarks.filter(l => l.coordinates).length}/${tourData.landmarks.length}` : 
        'N/A'
    };

    console.log('🎉 Enhanced tour generation completed successfully!');
    console.log(`📊 Final stats: ${enhancedTour.landmarks?.length || 0} landmarks, ${enhancedTour.geocoding_success_rate} geocoded`);

    return new Response(
      JSON.stringify(enhancedTour),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Enhanced tour generation failed:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate enhanced tour',
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
