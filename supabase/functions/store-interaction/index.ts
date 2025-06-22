
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function analyzeTextInteractionQuality(userInput: string, assistantResponse: string): Promise<any> {
  // Basic analysis for text-based interactions
  const analysis = {
    info_accuracy_status: 'good',
    info_accuracy_explanation: 'Text response provided relevant information',
    navigation_effectiveness_status: 'good',
    navigation_effectiveness_explanation: 'Clear guidance provided for requested destination',
    engagement_interactivity_status: userInput.split(' ').length > 10 ? 'excellent' : 'good',
    engagement_interactivity_explanation: userInput.split(' ').length > 10 ? 'User provide detailed query' : 'User engaged with specific question',
    problem_resolution_status: 'good',
    problem_resolution_explanation: 'User query addressed comprehensively',
    efficiency_conciseness_status: assistantResponse.length < 800 ? 'excellent' : 'good',
    efficiency_conciseness_explanation: assistantResponse.length < 800 ? 'Concise and focused response' : 'Comprehensive response provided',
    user_satisfaction_status: 'good',
    user_satisfaction_explanation: 'Interaction completed successfully'
  };

  return analysis;
}

async function analyzeProximityInteractionQuality(userInput: string, assistantResponse: string, discoveryDistance: number, transportationMode: string): Promise<any> {
  // Analysis specific to proximity discoveries
  const analysis = {
    info_accuracy_status: 'excellent',
    info_accuracy_explanation: 'Proximity discovery provided accurate location-based information',
    navigation_effectiveness_status: 'excellent',
    navigation_effectiveness_explanation: `User successfully discovered landmark while ${transportationMode}`,
    engagement_interactivity_status: 'excellent',
    engagement_interactivity_explanation: 'User physically engaged with environment through proximity discovery',
    problem_resolution_status: 'excellent',
    problem_resolution_explanation: 'Location-based discovery fulfilled user\'s exploration needs',
    efficiency_conciseness_status: discoveryDistance < 100 ? 'excellent' : 'good',
    efficiency_conciseness_explanation: discoveryDistance < 100 ? 'Very close proximity discovery' : 'Good proximity discovery range',
    user_satisfaction_status: 'excellent',
    user_satisfaction_explanation: 'Successful proximity-based landmark discovery while exploring'
  };

  return analysis;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Store interaction function called');
    
    const { 
      userInput, 
      assistantResponse, 
      destination,
      interactionType = 'text',
      landmarkCoordinates,
      landmarkImageUrl,
      // New proximity fields
      discoveryDistance,
      transportationMode,
      userLocation
    } = await req.json()
    
    console.log('Request body:', { 
      userInput, 
      assistantResponse, 
      destination, 
      interactionType,
      landmarkCoordinates,
      landmarkImageUrl,
      discoveryDistance,
      transportationMode,
      userLocation
    });

    if (!userInput || !assistantResponse || !destination) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userInput, assistantResponse, and destination are required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header provided' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }
    
    console.log('Creating Supabase client...');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get current user with better error handling
    console.log('Getting user...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError) {
      console.error('Error getting user:', userError);
      
      // Check if it's a token expiration error
      if (userError.message?.includes('expired') || userError.message?.includes('invalid')) {
        return new Response(
          JSON.stringify({ error: 'Authentication token expired or invalid. Please refresh and try again.' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
          }
        )
      }
      
      return new Response(
        JSON.stringify({ error: `User authentication error: ${userError.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }
    
    if (!user) {
      console.error('User not authenticated');
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }
    
    console.log('User authenticated:', user.id);

    // Generate embeddings using Gemini
    const geminiApiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    if (!geminiApiKey) {
      console.error('Gemini API key not configured');
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    console.log('Generating embeddings with Gemini...');
    
    // Generate embedding for user input
    const userInputEmbedding = await generateGeminiEmbedding(userInput, geminiApiKey)
    console.log('User input embedding generated, length:', userInputEmbedding.length);
    
    // Generate embedding for assistant response
    const assistantResponseEmbedding = await generateGeminiEmbedding(assistantResponse, geminiApiKey)
    console.log('Assistant response embedding generated, length:', assistantResponseEmbedding.length);

    // Analyze interaction quality based on type
    let qualityAnalysis;
    if (interactionType === 'proximity') {
      qualityAnalysis = await analyzeProximityInteractionQuality(userInput, assistantResponse, discoveryDistance || 0, transportationMode || 'walking');
      console.log('Quality analysis completed for proximity interaction');
    } else {
      qualityAnalysis = await analyzeTextInteractionQuality(userInput, assistantResponse);
      console.log('Quality analysis completed for text interaction');
    }

    // Prepare the data for insertion
    const insertData: any = {
      user_id: user.id,
      destination,
      user_input: userInput,
      assistant_response: assistantResponse,
      user_input_embedding: userInputEmbedding,
      assistant_response_embedding: assistantResponseEmbedding,
      interaction_type: interactionType,
      // Analytics fields
      call_status: 'completed',
      start_time: Date.now(),
      end_time: Date.now(),
      points_of_interest_mentioned: [destination],
      // Quality analysis fields
      info_accuracy_status: qualityAnalysis.info_accuracy_status,
      info_accuracy_explanation: qualityAnalysis.info_accuracy_explanation,
      navigation_effectiveness_status: qualityAnalysis.navigation_effectiveness_status,
      navigation_effectiveness_explanation: qualityAnalysis.navigation_effectiveness_explanation,
      engagement_interactivity_status: qualityAnalysis.engagement_interactivity_status,
      engagement_interactivity_explanation: qualityAnalysis.engagement_interactivity_explanation,
      problem_resolution_status: qualityAnalysis.problem_resolution_status,
      problem_resolution_explanation: qualityAnalysis.problem_resolution_explanation,
      efficiency_conciseness_status: qualityAnalysis.efficiency_conciseness_status,
      efficiency_conciseness_explanation: qualityAnalysis.efficiency_conciseness_explanation,
      user_satisfaction_status: qualityAnalysis.user_satisfaction_status,
      user_satisfaction_explanation: qualityAnalysis.user_satisfaction_explanation
    }

    // Add proximity-specific fields
    if (interactionType === 'proximity') {
      if (discoveryDistance) {
        insertData.discovery_distance = discoveryDistance;
      }
      if (transportationMode) {
        insertData.transportation_mode = transportationMode;
      }
      if (userLocation && Array.isArray(userLocation) && userLocation.length === 2) {
        insertData.user_location = `(${userLocation[0]}, ${userLocation[1]})`;
      }
    }

    // Generate embedding for points of interest (destination)
    console.log('Generating embedding for points of interest...');
    insertData.points_of_interest_embedding = await generateGeminiEmbedding(destination, geminiApiKey);
    console.log('Points of interest embedding generated');

    // Generate embedding for evaluation criteria summary
    const evaluationCriteriaText = `Information Accuracy: ${qualityAnalysis.info_accuracy_status} - ${qualityAnalysis.info_accuracy_explanation}. Navigation Effectiveness: ${qualityAnalysis.navigation_effectiveness_status} - ${qualityAnalysis.navigation_effectiveness_explanation}. User Engagement: ${qualityAnalysis.engagement_interactivity_status} - ${qualityAnalysis.engagement_interactivity_explanation}.`;
    console.log('Generating embedding for evaluation criteria...');
    insertData.evaluation_criteria_embedding = await generateGeminiEmbedding(evaluationCriteriaText, geminiApiKey);
    console.log('Evaluation criteria embedding generated');

    // Add optional fields if provided
    if (landmarkCoordinates && Array.isArray(landmarkCoordinates) && landmarkCoordinates.length === 2) {
      // Convert [lng, lat] to PostgreSQL POINT format
      insertData.landmark_coordinates = `(${landmarkCoordinates[0]}, ${landmarkCoordinates[1]})`
    }

    if (landmarkImageUrl) {
      insertData.landmark_image_url = landmarkImageUrl
    }

    // Store the interaction in the database
    console.log('Storing interaction in database...');
    const { data, error } = await supabaseClient
      .from('interactions')
      .insert(insertData)

    if (error) {
      console.error('Database error:', error)
      
      // Handle specific database errors
      if (error.code === '42501') {
        return new Response(
          JSON.stringify({ error: 'Database permission error. Please check authentication.' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403 
          }
        )
      }
      
      return new Response(
        JSON.stringify({ error: `Database error: ${error.message}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    console.log('Interaction stored successfully:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data,
        embeddings_generated: {
          user_input: true,
          assistant_response: true,
          points_of_interest: true,
          evaluation_criteria: true
        },
        interaction_type: interactionType,
        proximity_data: interactionType === 'proximity' ? {
          discovery_distance: discoveryDistance,
          transportation_mode: transportationMode,
          user_location: userLocation
        } : null
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error storing interaction:', error)
    return new Response(
      JSON.stringify({ error: `Unexpected error: ${error.message}` }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

async function generateGeminiEmbedding(text: string, apiKey: string): Promise<number[]> {
  console.log('Generating Gemini embedding for text length:', text.length);
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'models/text-embedding-004',
      content: {
        parts: [{ text: text }]
      }
    }),
  })

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);
    throw new Error(`Failed to generate embedding: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  console.log('Gemini embedding generated successfully');
  return data.embedding.values
}
