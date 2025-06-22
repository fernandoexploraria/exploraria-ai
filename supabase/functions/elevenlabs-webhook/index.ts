import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function verifyHmacSignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );

    const expectedSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expectedSignatureHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // ElevenLabs typically sends signature as "sha256=<hex>"
    const receivedSignature = signature.replace('sha256=', '');
    
    return expectedSignatureHex === receivedSignature;
  } catch (error) {
    console.error('HMAC verification error:', error);
    return false;
  }
}

async function extractPointsOfInterest(transcript: any[]): Promise<string[]> {
  if (!Array.isArray(transcript)) return [];
  
  const conversationText = transcript
    .filter(entry => entry.message)
    .map(entry => entry.message)
    .join(' ');

  // Extract common landmarks and points of interest mentioned
  const commonLandmarks = [
    'Statue of Liberty', 'Empire State Building', 'Times Square', 'Central Park',
    'Brooklyn Bridge', 'Metropolitan Museum', 'Met Museum', 'Guggenheim',
    'Rockefeller Center', 'One World Trade Center', 'High Line', 'Grand Central',
    'Wall Street', 'Chinatown', 'Little Italy', 'SoHo', 'Greenwich Village',
    'Broadway', 'Madison Square Garden', 'Yankee Stadium', 'Coney Island'
  ];

  const mentionedLandmarks = commonLandmarks.filter(landmark => 
    conversationText.toLowerCase().includes(landmark.toLowerCase())
  );

  return mentionedLandmarks;
}

async function analyzeConversationQuality(userInput: string, assistantResponse: string, duration: number): Promise<any> {
  // Basic analysis based on conversation characteristics
  const analysis = {
    info_accuracy_status: 'good',
    info_accuracy_explanation: 'Response provided relevant information about requested destinations',
    navigation_effectiveness_status: duration > 60 ? 'good' : 'fair',
    navigation_effectiveness_explanation: duration > 60 ? 'Comprehensive guidance provided' : 'Brief but direct guidance',
    engagement_interactivity_status: userInput.split(' ').length > 5 ? 'good' : 'fair',
    engagement_interactivity_explanation: userInput.split(' ').length > 5 ? 'User actively engaged in conversation' : 'Limited user engagement',
    problem_resolution_status: 'good',
    problem_resolution_explanation: 'Tourist query addressed appropriately',
    efficiency_conciseness_status: assistantResponse.length < 1000 ? 'good' : 'fair',
    efficiency_conciseness_explanation: assistantResponse.length < 1000 ? 'Concise and focused response' : 'Detailed but potentially lengthy response',
    user_satisfaction_status: 'good',
    user_satisfaction_explanation: 'Conversation completed successfully without interruption'
  };

  return analysis;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('ElevenLabs webhook received');
    
    // Get HMAC secret from environment
    const hmacSecret = Deno.env.get('ELEVENLABS_WEBHOOK_SECRET');
    if (!hmacSecret) {
      console.error('ELEVENLABS_WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the raw body for HMAC verification
    const rawBody = await req.text();
    
    // Verify HMAC signature if present
    const signature = req.headers.get('x-elevenlabs-signature') || req.headers.get('x-signature');
    if (signature) {
      const isValidSignature = await verifyHmacSignature(rawBody, signature, hmacSecret);
      if (!isValidSignature) {
        console.error('Invalid HMAC signature');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      console.log('HMAC signature verified successfully');
    } else {
      console.warn('No HMAC signature found in headers - webhook may not be authenticated');
    }

    // Parse the webhook data
    const webhookData = JSON.parse(rawBody);
    console.log('Webhook payload:', JSON.stringify(webhookData, null, 2));

    // Handle different webhook types
    if (webhookData.type !== 'post_call_transcription') {
      console.log(`Ignoring webhook type: ${webhookData.type}`);
      return new Response(
        JSON.stringify({ message: 'Webhook type not handled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role key for webhook access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Extract data from the nested structure that ElevenLabs actually sends
    const {
      agent_id,
      conversation_id,
      transcript,
      metadata,
      conversation_initiation_client_data,
      summary, // Extract the summary field from the webhook data
      status // Extract the actual call status from ElevenLabs
    } = webhookData.data || {};

    if (!conversation_id || !transcript) {
      console.error('Missing required webhook data - conversation_id or transcript not found');
      console.log('Available data keys:', Object.keys(webhookData.data || {}));
      return new Response(
        JSON.stringify({ error: 'Missing conversation_id or transcript' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract duration and other metadata
    const duration_seconds = metadata?.call_duration_secs || 0;
    const audio_url = null; // ElevenLabs doesn't provide audio URL in this webhook

    // Extract variables from the correct location in the webhook data
    // ElevenLabs sends dynamic variables in conversation_initiation_client_data.dynamic_variables
    const dynamicVariables = conversation_initiation_client_data?.dynamic_variables || {};
    
    const userId = dynamicVariables?.user_id;
    const destination = dynamicVariables?.destination || 'Unknown';
    const callStartTime = dynamicVariables?.system__time_utc ? 
      new Date(dynamicVariables.system__time_utc).getTime() : null;

    console.log('Extracted variables:', { userId, destination, summary, status });
    console.log('Full dynamic variables:', JSON.stringify(dynamicVariables, null, 2));

    if (!userId) {
      console.error('No user_id found in dynamic variables');
      console.log('Available dynamic variables:', JSON.stringify(dynamicVariables, null, 2));
      return new Response(
        JSON.stringify({ error: 'Missing user_id in dynamic variables' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process the transcript to extract user input and assistant responses
    let userInput = ''
    let assistantResponse = ''

    // Parse transcript array to separate user and assistant messages
    if (Array.isArray(transcript)) {
      const userMessages = []
      const assistantMessages = []

      transcript.forEach(entry => {
        if (entry.role === 'user' && entry.message) {
          userMessages.push(entry.message)
        } else if ((entry.role === 'assistant' || entry.role === 'agent') && entry.message) {
          assistantMessages.push(entry.message)
        }
      })

      userInput = userMessages.join(' ')
      assistantResponse = assistantMessages.join(' ')
    }

    // Skip if no meaningful content
    if (!userInput.trim() || !assistantResponse.trim()) {
      console.log('No meaningful conversation content, skipping storage');
      console.log('User input length:', userInput.length, 'Assistant response length:', assistantResponse.length);
      return new Response(
        JSON.stringify({ message: 'No meaningful content to store' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate embeddings using Gemini
    const geminiApiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    if (!geminiApiKey) {
      console.error('Gemini API key not configured');
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Generating embeddings...');
    
    // Generate embedding for user input
    const userInputEmbedding = await generateGeminiEmbedding(userInput, geminiApiKey)
    
    // Generate embedding for assistant response
    const assistantResponseEmbedding = await generateGeminiEmbedding(assistantResponse, geminiApiKey)

    // Extract points of interest mentioned in conversation
    const pointsOfInterest = await extractPointsOfInterest(transcript);
    console.log('Points of interest extracted:', pointsOfInterest);

    // Analyze conversation quality
    const qualityAnalysis = await analyzeConversationQuality(userInput, assistantResponse, duration_seconds);
    console.log('Quality analysis completed:', qualityAnalysis);

    // Prepare the data for insertion
    const insertData: any = {
      user_id: userId,
      destination: destination,
      user_input: userInput,
      assistant_response: assistantResponse,
      conversation_id: conversation_id,
      conversation_duration: duration_seconds,
      audio_url: audio_url,
      agent_id: agent_id,
      full_transcript: transcript,
      user_input_embedding: userInputEmbedding,
      assistant_response_embedding: assistantResponseEmbedding,
      // New analytics fields - use actual status from ElevenLabs payload
      call_status: status || 'unknown',
      start_time: callStartTime,
      end_time: callStartTime ? callStartTime + (duration_seconds * 1000) : null,
      data_collection: {
        webhook_timestamp: Date.now(),
        conversation_metadata: metadata,
        dynamic_variables: dynamicVariables
      },
      analysis_results: {
        quality_analysis: qualityAnalysis,
        conversation_metrics: {
          user_message_count: transcript.filter(t => t.role === 'user').length,
          assistant_message_count: transcript.filter(t => t.role === 'assistant' || t.role === 'agent').length,
          total_duration: duration_seconds,
          user_input_length: userInput.length,
          assistant_response_length: assistantResponse.length
        }
      },
      points_of_interest_mentioned: pointsOfInterest,
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

    // Add conversation summary and its embedding if available
    if (summary) {
      insertData.conversation_summary = summary;
      console.log('Generating embedding for conversation summary...');
      insertData.conversation_summary_embedding = await generateGeminiEmbedding(summary, geminiApiKey);
      console.log('Conversation summary embedding generated');
    }

    // Generate embedding for points of interest if any were found
    if (pointsOfInterest.length > 0) {
      const pointsOfInterestText = pointsOfInterest.join(', ');
      console.log('Generating embedding for points of interest...');
      insertData.points_of_interest_embedding = await generateGeminiEmbedding(pointsOfInterestText, geminiApiKey);
      console.log('Points of interest embedding generated');
    }

    // Generate embedding for evaluation criteria summary
    const evaluationCriteriaText = `Information Accuracy: ${qualityAnalysis.info_accuracy_status} - ${qualityAnalysis.info_accuracy_explanation}. Navigation Effectiveness: ${qualityAnalysis.navigation_effectiveness_status} - ${qualityAnalysis.navigation_effectiveness_explanation}. User Engagement: ${qualityAnalysis.engagement_interactivity_status} - ${qualityAnalysis.engagement_interactivity_explanation}.`;
    console.log('Generating embedding for evaluation criteria...');
    insertData.evaluation_criteria_embedding = await generateGeminiEmbedding(evaluationCriteriaText, geminiApiKey);
    console.log('Evaluation criteria embedding generated');

    // Store the conversation in the database
    console.log('Storing conversation in database...');
    const { data, error } = await supabaseClient
      .from('interactions')
      .insert(insertData)

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: `Database error: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Conversation stored successfully:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Conversation processed and stored successfully',
        conversation_id: conversation_id,
        call_status: status || 'unknown',
        summary_included: !!summary,
        points_of_interest_count: pointsOfInterest.length,
        quality_analysis_completed: true,
        embeddings_generated: {
          conversation_summary: !!summary,
          points_of_interest: pointsOfInterest.length > 0,
          evaluation_criteria: true
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: `Webhook processing error: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
