import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to log tour generation events
const logTourGeneration = async (tourId: string, phase: string, level: string, message: string, details: any = {}) => {
  try {
    const logData = {
      tour_id: tourId,
      phase: phase,
      level: level,
      message: message,
      details: details,
      created_at: new Date().toISOString()
    };

    console.log(`[${level.toUpperCase()}] ${phase}: ${message}`, details);

    // Skip logging to Supabase in the local environment
    if (Deno.env.get('SUPABASE_URL')) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

      const response = await fetch(`${supabaseUrl}/rest/v1/tour_generation_logs`, {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal' // Minimize response body
        },
        body: JSON.stringify(logData)
      });

      if (!response.ok) {
        console.error('Failed to log to Supabase:', response.status, response.statusText);
        const errorBody = await response.text();
        console.error('Supabase error details:', errorBody);
      }
    } else {
      console.log('Skipping Supabase logging in local environment.');
    }

  } catch (logError) {
    console.error('Error logging tour generation event:', logError);
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destination, destinationDetails } = await req.json();
    
    console.log('🎯 Enhanced tour generation request:', { 
      destination, 
      hasDestinationDetails: !!destinationDetails,
      destinationTypes: destinationDetails?.types 
    });

    if (!destination) {
      throw new Error('Destination is required');
    }

    const startTime = Date.now();
    const tourId = crypto.randomUUID();

    // Log tour generation start
    await logTourGeneration(tourId, 'initialization', 'info', 'Tour generation started', {
      destination,
      destinationDetails: destinationDetails || null
    });

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    const googleAiApiKey = Deno.env.get('GOOGLE_AI_API_KEY');

    if (!googleApiKey || !googleAiApiKey) {
      throw new Error('Google API keys not configured');
    }

    // Get the user ID from the request header
    const authHeader = req.headers.get('Authorization');
    const userId = authHeader ? authHeader.split(' ')[1] : null; // Extract token

    if (!userId) {
      console.warn('⚠️ User ID missing in request header');
      await logTourGeneration(tourId, 'authentication', 'warn', 'User ID missing in request header');
    }

    try {
      // Phase 1: Enhanced AI Landmark Generation with Destination Context
      console.log('🤖 Generating landmarks with enhanced context...');
      await logTourGeneration(tourId, 'ai_generation', 'info', 'Starting AI landmark generation with destination context');
      
      // Build enhanced prompt with destination context
      let contextualPrompt = `Generate a comprehensive tourist itinerary for ${destination}.`;
      
      if (destinationDetails) {
        if (destinationDetails.types && destinationDetails.types.length > 0) {
          const typeDescriptions = {
            'locality': 'major city or town',
            'sublocality': 'neighborhood or district',
            'tourist_attraction': 'popular tourist destination',
            'museum': 'cultural institution',
            'park': 'natural or recreational area',
            'administrative_area_level_1': 'state or province',
            'administrative_area_level_2': 'county or region'
          };
          
          const primaryType = destinationDetails.types[0];
          const typeDescription = typeDescriptions[primaryType] || 'location';
          contextualPrompt += ` This destination is classified as a ${typeDescription}.`;
        }
        
        if (destinationDetails.formattedAddress) {
          contextualPrompt += ` The full address context is: ${destinationDetails.formattedAddress}.`;
        }
        
        if (destinationDetails.location) {
          contextualPrompt += ` The coordinates are approximately ${destinationDetails.location.latitude}, ${destinationDetails.location.longitude}.`;
        }
      }

      contextualPrompt += `

Please provide a comprehensive list of 12-15 must-visit landmarks, attractions, and points of interest. Focus on:

1. **Major Tourist Attractions**: Famous landmarks, monuments, and iconic sites
2. **Cultural Sites**: Museums, galleries, theaters, and cultural centers  
3. **Historical Places**: Historic buildings, districts, and heritage sites
4. **Natural Attractions**: Parks, gardens, viewpoints, and natural features
5. **Local Experiences**: Markets, neighborhoods, and authentic local spots
6. **Architectural Highlights**: Notable buildings and architectural wonders

For each landmark, provide:
- **Name**: Clear, specific name of the landmark
- **Description**: 2-3 sentences describing what makes it special and worth visiting
- **Category**: Type of attraction (e.g., "Museum", "Historic Site", "Park", "Market")

Format your response as a JSON object with a "landmarks" array. Each landmark should have "name", "description", and "category" fields.

Focus on diversity - include a mix of famous must-sees and hidden gems. Prioritize accuracy and ensure all landmarks actually exist in ${destination}.`;

      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleAiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: contextualPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        })
      });

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error('❌ Gemini API error:', geminiResponse.status, errorText);
        throw new Error(`Gemini API error: ${geminiResponse.status}`);
      }

      const geminiData = await geminiResponse.json();
      
      if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid response from Gemini AI');
      }

      let landmarksText = geminiData.candidates[0].content.parts[0].text;
      console.log('📄 Raw Gemini response length:', landmarksText.length);

      // Attempt to parse the landmarks from the Gemini response
      let landmarks;
      try {
        const jsonStartIndex = landmarksText.indexOf('{');
        if (jsonStartIndex === -1) {
          throw new Error('No JSON object found in Gemini response');
        }
        landmarksText = landmarksText.substring(jsonStartIndex);
        landmarks = JSON.parse(landmarksText).landmarks;
        console.log('✅ Landmarks parsed successfully from Gemini response');
      } catch (jsonError) {
        console.error('❌ Error parsing landmarks JSON:', jsonError);
        console.log('Raw Gemini response causing the error:', landmarksText);
        throw new Error(`Failed to parse landmarks from Gemini response: ${jsonError}`);
      }

      if (!landmarks || !Array.isArray(landmarks)) {
        throw new Error('Invalid landmarks format in Gemini response');
      }

      // Phase 2: Coordinate Enrichment and Validation
      console.log('📍 Enriching landmarks with coordinates...');
      await logTourGeneration(tourId, 'coordinate_enrichment', 'info', 'Starting coordinate enrichment for landmarks');

      const enrichedLandmarks = [];
      const fallbacksUsed = [];
      let coordinateQuality = {
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0
      };

      for (const landmark of landmarks) {
        let placeDetails = null;
        let coordinateSource = 'none';
        let confidence = 'low';

        try {
          // Attempt 1: Google Places API - Reliable but rate-limited
          const placesResponse = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(landmark.name + ' ' + destination)}&inputtype=textquery&fields=place_id,formatted_address,name,geometry,types&key=${googleApiKey}`);

          if (placesResponse.ok) {
            const placesData = await placesResponse.json();

            if (placesData.candidates && placesData.candidates.length > 0) {
              placeDetails = placesData.candidates[0];
              coordinateSource = 'google_places';
              confidence = 'high';
            }
          } else {
            console.warn('Google Places API request failed:', placesResponse.status, placesResponse.statusText);
          }
        } catch (placesError) {
          console.error('Error fetching place details from Google Places API:', placesError);
        }

        // Attempt 2: Geocoding API - Less reliable, use as fallback
        if (!placeDetails) {
          try {
            const geocodingResponse = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(landmark.name + ' in ' + destination)}&key=${googleApiKey}`);

            if (geocodingResponse.ok) {
              const geocodingData = await geocodingResponse.json();

              if (geocodingData.results && geocodingData.results.length > 0) {
                const result = geocodingData.results[0];
                placeDetails = {
                  geometry: { location: result.geometry.location },
                  formatted_address: result.formatted_address,
                  name: result.name || landmark.name,
                  types: result.types || []
                };
                coordinateSource = 'geocoding_api';
                confidence = 'medium';
                fallbacksUsed.push('geocoding_api');
              }
            } else {
              console.warn('Geocoding API request failed:', geocodingResponse.status, geocodingResponse.statusText);
            }
          } catch (geocodingError) {
            console.error('Error fetching geocoding details:', geocodingError);
          }
        }

        // Classify coordinate confidence
        if (confidence === 'high') {
          coordinateQuality.highConfidence++;
        } else if (confidence === 'medium') {
          coordinateQuality.mediumConfidence++;
        } else {
          coordinateQuality.lowConfidence++;
        }

        if (placeDetails && placeDetails.geometry && placeDetails.geometry.location) {
          enrichedLandmarks.push({
            id: crypto.randomUUID(),
            name: landmark.name,
            description: landmark.description,
            coordinates: {
              latitude: placeDetails.geometry.location.lat,
              longitude: placeDetails.geometry.location.lng
            },
            placeId: placeDetails.place_id || null,
            coordinateSource: coordinateSource,
            confidence: confidence,
            types: placeDetails.types || [],
            formattedAddress: placeDetails.formatted_address || null
          });
        } else {
          console.warn('⚠️ No coordinates found for landmark:', landmark.name);
          await logTourGeneration(tourId, 'coordinate_enrichment', 'warn', 'No coordinates found for landmark', { landmarkName: landmark.name });

          enrichedLandmarks.push({
            id: crypto.randomUUID(),
            name: landmark.name,
            description: landmark.description,
            coordinates: null,
            placeId: null,
            coordinateSource: 'none',
            confidence: 'none',
            types: [],
            formattedAddress: null
          });
        }
      }

      const totalProcessingTime = Date.now() - startTime;
      console.log(`⏱️  Total processing time: ${totalProcessingTime}ms`);
      await logTourGeneration(tourId, 'processing_time', 'info', 'Total processing time', { processingTimeMs: totalProcessingTime });

      // Store generated tour details in the database
      if (userId) {
        console.log('💾 Storing generated tour in database for user:', userId);
        await logTourGeneration(tourId, 'database_storage', 'info', 'Storing generated tour in database', { userId });

        const { data: tourData, error: tourError } = await supabase
          .from('generated_tours')
          .insert({
            id: tourId,
            user_id: userId,
            destination: destination,
            landmarks: enrichedLandmarks,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (tourError) {
          console.error('Failed to store generated tour in database:', tourError);
          await logTourGeneration(tourId, 'database_storage', 'error', 'Failed to store generated tour in database', { error: tourError });
        } else {
          console.log('✅ Generated tour stored successfully in database');
          await logTourGeneration(tourId, 'database_storage', 'info', 'Generated tour stored successfully in database', { tourId: tourData.id });
        }
      } else {
        console.warn('⚠️ User ID not available, skipping database storage');
        await logTourGeneration(tourId, 'database_storage', 'warn', 'User ID not available, skipping database storage');
      }

      // Store destination details in the tour record
      await supabase
        .from('generated_tours')
        .update({
          destination_details: destinationDetails || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', tourId);

      console.log('✅ Enhanced tour generation completed with destination context');
      await logTourGeneration(tourId, 'completion', 'info', 'Enhanced tour generation completed successfully', {
        totalLandmarks: enrichedLandmarks.length,
        destinationContextUsed: !!destinationDetails,
        coordinateQuality,
        processingTimeMs: totalProcessingTime
      });

      return new Response(JSON.stringify({
        landmarks: enrichedLandmarks,
        systemPrompt: contextualPrompt,
        metadata: {
          totalLandmarks: enrichedLandmarks.length,
          coordinateQuality,
          processingTime: totalProcessingTime,
          fallbacksUsed,
          destinationContext: destinationDetails ? 'enhanced' : 'basic'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('❌ Error in enhanced tour generation:', error);
      await logTourGeneration(tourId, 'error', 'error', 'Error in enhanced tour generation', { error: error.message });

      return new Response(JSON.stringify({
        error: error.message,
        landmarks: [],
        systemPrompt: '',
        metadata: {
          totalLandmarks: 0,
          coordinateQuality: {
            highConfidence: 0,
            mediumConfidence: 0,
            lowConfidence: 0
          },
          processingTime: 0,
          fallbacksUsed: [],
          destinationContext: 'basic'
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error in google-places-autocomplete function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      predictions: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
