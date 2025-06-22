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

async function extractPointsOfInterest(transcript: any[], geminiApiKey: string): Promise<string[]> {
  if (!Array.isArray(transcript) || transcript.length === 0) {
    console.log('No transcript available for POI extraction');
    return [];
  }
  
  // Only extract text from user messages, not assistant responses
  const userInput = transcript
    .filter(entry => entry && entry.role === 'user' && entry.message && entry.message.trim())
    .map(entry => entry.message.trim())
    .join(' ');

  if (!userInput.trim()) {
    console.log('No user input found for POI extraction');
    return [];
  }

  console.log('Extracting points of interest with Gemini AI... User input length:', userInput.length);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Extract all landmarks, tourist attractions, places, and points of interest mentioned in this user input. Return ONLY a JSON array of strings with the names of the places mentioned. If no places are mentioned, return an empty array [].

IMPORTANT: Your response must be ONLY valid JSON, no other text.

Examples:
- Input: "I want to visit the Statue of Liberty and Times Square" → ["Statue of Liberty", "Times Square"]
- Input: "Take me to Central Park" → ["Central Park"]
- Input: "Where is the Empire State Building?" → ["Empire State Building"]
- Input: "Hello, how are you?" → []

User input: "${userInput}"`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 500,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error for POI extraction:', response.status, errorText);
      return [];
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
      console.error('Invalid Gemini response structure for POI extraction:', JSON.stringify(data, null, 2));
      return [];
    }

    const responseText = data.candidates[0].content.parts[0].text.trim();
    console.log('Gemini POI extraction response:', responseText);

    // Parse the JSON response, handling markdown code blocks
    try {
      // Remove markdown code block formatting if present
      const cleanedResponse = responseText.replace(/```json\n?|\n?```|```/g, '').trim();
      console.log('Cleaned POI response:', cleanedResponse);
      
      const pointsOfInterest = JSON.parse(cleanedResponse);
      if (Array.isArray(pointsOfInterest)) {
        const validPOIs = pointsOfInterest.filter(poi => typeof poi === 'string' && poi.trim().length > 0);
        console.log('Valid POIs extracted:', validPOIs);
        return validPOIs;
      } else {
        console.error('POI response is not an array:', pointsOfInterest);
        return [];
      }
    } catch (parseError) {
      console.error('Failed to parse POI JSON response:', parseError);
      console.log('Raw response that failed to parse:', responseText);
      return [];
    }

  } catch (error) {
    console.error('Error extracting points of interest with Gemini:', error);
    return [];
  }
}

async function analyzeConversationQuality(transcript: any[], duration: number, geminiApiKey: string): Promise<any> {
  // Skip AI analysis for conversations shorter than 30 seconds
  if (duration < 30) {
    console.log('Conversation too short for AI analysis, using basic fallback');
    return {
      info_accuracy_status: 'fair',
      info_accuracy_explanation: 'Conversation too short for meaningful accuracy assessment',
      navigation_effectiveness_status: 'fair',
      navigation_effectiveness_explanation: 'Limited interaction time for navigation guidance',
      engagement_interactivity_status: 'fair',
      engagement_interactivity_explanation: 'Brief interaction with limited engagement opportunity',
      problem_resolution_status: 'fair',
      problem_resolution_explanation: 'Short conversation with minimal problem-solving context',
      efficiency_conciseness_status: 'good',
      efficiency_conciseness_explanation: 'Quick resolution appropriate for brief interaction',
      user_satisfaction_status: 'fair',
      user_satisfaction_explanation: 'Limited interaction time to assess satisfaction'
    };
  }

  if (!Array.isArray(transcript) || transcript.length === 0) {
    console.log('No transcript available for AI analysis');
    return {
      info_accuracy_status: 'poor',
      info_accuracy_explanation: 'No conversation content available for analysis',
      navigation_effectiveness_status: 'poor',
      navigation_effectiveness_explanation: 'No conversation content available for analysis',
      engagement_interactivity_status: 'poor',
      engagement_interactivity_explanation: 'No conversation content available for analysis',
      problem_resolution_status: 'poor',
      problem_resolution_explanation: 'No conversation content available for analysis',
      efficiency_conciseness_status: 'poor',
      efficiency_conciseness_explanation: 'No conversation content available for analysis',
      user_satisfaction_status: 'poor',
      user_satisfaction_explanation: 'No conversation content available for analysis'
    };
  }

  // Format conversation for AI analysis - filter out empty messages
  const conversationText = transcript
    .filter(entry => entry && entry.message && entry.message.trim())
    .map(entry => `${entry.role === 'user' ? 'Tourist' : 'Guide'}: ${entry.message.trim()}`)
    .join('\n');

  if (!conversationText.trim()) {
    console.log('No meaningful conversation content for AI analysis');
    return {
      info_accuracy_status: 'poor',
      info_accuracy_explanation: 'No meaningful conversation content available',
      navigation_effectiveness_status: 'poor',
      navigation_effectiveness_explanation: 'No meaningful conversation content available',
      engagement_interactivity_status: 'poor',
      engagement_interactivity_explanation: 'No meaningful conversation content available',
      problem_resolution_status: 'poor',
      problem_resolution_explanation: 'No meaningful conversation content available',
      efficiency_conciseness_status: 'poor',
      efficiency_conciseness_explanation: 'No meaningful conversation content available',
      user_satisfaction_status: 'poor',
      user_satisfaction_explanation: 'No meaningful conversation content available'
    };
  }

  const userMessageCount = transcript.filter(t => t && t.role === 'user').length;
  const agentMessageCount = transcript.filter(t => t && (t.role === 'assistant' || t.role === 'agent')).length;

  console.log('Analyzing conversation quality with AI... Conversation length:', conversationText.length);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `IMPORTANT: Return ONLY valid JSON, no other text or explanations.

Analyze this tour guide conversation and evaluate it across 6 criteria. For each criterion, provide a status (excellent/good/fair/poor) and a 2-3 sentence explanation.

CONVERSATION METADATA:
- Duration: ${duration} seconds
- Tourist messages: ${userMessageCount}
- Guide responses: ${agentMessageCount}
- Total turns: ${transcript.length}

CONVERSATION:
${conversationText}

Return ONLY this JSON structure:
{
  "info_accuracy_status": "excellent|good|fair|poor",
  "info_accuracy_explanation": "explanation text",
  "navigation_effectiveness_status": "excellent|good|fair|poor",
  "navigation_effectiveness_explanation": "explanation text",
  "engagement_interactivity_status": "excellent|good|fair|poor",
  "engagement_interactivity_explanation": "explanation text",
  "problem_resolution_status": "excellent|good|fair|poor",
  "problem_resolution_explanation": "explanation text",
  "efficiency_conciseness_status": "excellent|good|fair|poor",
  "efficiency_conciseness_explanation": "explanation text",
  "user_satisfaction_status": "excellent|good|fair|poor",
  "user_satisfaction_explanation": "explanation text"
}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1000,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error for quality analysis:', response.status, errorText);
      // Return fallback analysis
      return {
        info_accuracy_status: 'fair',
        info_accuracy_explanation: 'Unable to analyze accuracy due to API error',
        navigation_effectiveness_status: 'fair',
        navigation_effectiveness_explanation: 'Unable to analyze navigation effectiveness due to API error',
        engagement_interactivity_status: 'fair',
        engagement_interactivity_explanation: 'Unable to analyze engagement due to API error',
        problem_resolution_status: 'fair',
        problem_resolution_explanation: 'Unable to analyze problem resolution due to API error',
        efficiency_conciseness_status: 'fair',
        efficiency_conciseness_explanation: 'Unable to analyze efficiency due to API error',
        user_satisfaction_status: 'fair',
        user_satisfaction_explanation: 'Unable to analyze satisfaction due to API error'
      };
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
      console.error('Invalid Gemini response structure for quality analysis:', JSON.stringify(data, null, 2));
      throw new Error('Invalid API response structure');
    }

    const responseText = data.candidates[0].content.parts[0].text.trim();
    console.log('AI quality analysis response preview:', responseText.substring(0, 200) + '...');

    // Parse the JSON response, handling markdown code blocks
    try {
      // Remove markdown code block formatting if present
      const cleanedResponse = responseText.replace(/```json\n?|\n?```|```/g, '').trim();
      console.log('Cleaned analysis response length:', cleanedResponse.length);
      
      const analysis = JSON.parse(cleanedResponse);
      
      // Validate that all required fields are present
      const requiredFields = [
        'info_accuracy_status', 'info_accuracy_explanation',
        'navigation_effectiveness_status', 'navigation_effectiveness_explanation',
        'engagement_interactivity_status', 'engagement_interactivity_explanation',
        'problem_resolution_status', 'problem_resolution_explanation',
        'efficiency_conciseness_status', 'efficiency_conciseness_explanation',
        'user_satisfaction_status', 'user_satisfaction_explanation'
      ];

      const missingFields = requiredFields.filter(field => !analysis[field]);
      if (missingFields.length > 0) {
        console.error('Missing fields in AI analysis:', missingFields);
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      console.log('AI quality analysis completed successfully');
      return analysis;

    } catch (parseError) {
      console.error('Failed to parse AI quality analysis JSON:', parseError);
      console.log('Raw AI response that failed to parse:', responseText);
      throw parseError;
    }

  } catch (error) {
    console.error('Error in AI quality analysis:', error);
    // Return fallback analysis
    return {
      info_accuracy_status: 'fair',
      info_accuracy_explanation: 'Analysis failed due to processing error',
      navigation_effectiveness_status: 'fair',  
      navigation_effectiveness_explanation: 'Analysis failed due to processing error',
      engagement_interactivity_status: 'fair',
      engagement_interactivity_explanation: 'Analysis failed due to processing error',
      problem_resolution_status: 'fair',
      problem_resolution_explanation: 'Analysis failed due to processing error',
      efficiency_conciseness_status: 'fair',
      efficiency_conciseness_explanation: 'Analysis failed due to processing error',
      user_satisfaction_status: 'fair',
      user_satisfaction_explanation: 'Analysis failed due to processing error'
    };
  }
}

async function generateConversationSummary(transcript: any[], geminiApiKey: string): Promise<string> {
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return "No conversation content available to summarize.";
  }

  // Extract conversation text from transcript
  const conversationText = transcript
    .filter(entry => entry && entry.message && entry.message.trim())
    .map(entry => `${entry.role === 'user' ? 'Tourist' : 'Guide'}: ${entry.message.trim()}`)
    .join('\n');

  if (!conversationText.trim()) {
    return "No meaningful conversation content to summarize.";
  }

  console.log('Generating conversation summary with Gemini...');

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Please provide a concise summary of this tourist guide conversation. Focus on the key destinations discussed, main questions asked, and guidance provided. Keep it under 200 words.

Conversation:
${conversationText}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 500,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error for summary:', response.status, errorText);
      return "Summary generation failed due to API error.";
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('Invalid Gemini response structure for summary:', data);
      return "Summary generation failed due to invalid response.";
    }

    const summary = data.candidates[0].content.parts[0].text.trim();
    console.log('Conversation summary generated successfully');
    return summary;

  } catch (error) {
    console.error('Error generating conversation summary:', error);
    return "Summary generation failed due to unexpected error.";
  }
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
        if (entry && entry.role === 'user' && entry.message) {
          userMessages.push(entry.message)
        } else if (entry && (entry.role === 'assistant' || entry.role === 'agent') && entry.message) {
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

    // Generate conversation summary using Gemini
    console.log('Generating conversation summary...');
    const generatedSummary = await generateConversationSummary(transcript, geminiApiKey);
    console.log('Summary generated:', generatedSummary.substring(0, 100) + '...');

    // Extract points of interest mentioned in conversation using Gemini AI
    console.log('Extracting points of interest...');
    const pointsOfInterest = await extractPointsOfInterest(transcript, geminiApiKey);
    console.log('Points of interest extracted:', pointsOfInterest.length, 'items:', pointsOfInterest);

    // Analyze conversation quality using AI
    console.log('Starting AI quality analysis...');
    const qualityAnalysis = await analyzeConversationQuality(transcript, duration_seconds, geminiApiKey);
    console.log('AI quality analysis completed:', Object.keys(qualityAnalysis));

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
      conversation_summary: generatedSummary,
      // New analytics fields - use actual status from ElevenLabs payload
      call_status: status || 'unknown',
      start_time: callStartTime,
      end_time: callStartTime ? callStartTime + (duration_seconds * 1000) : null,
      points_of_interest_mentioned: pointsOfInterest,
      // Quality analysis fields from AI
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

    // Generate embedding for conversation summary
    console.log('Generating embedding for conversation summary...');
    insertData.conversation_summary_embedding = await generateGeminiEmbedding(generatedSummary, geminiApiKey);
    console.log('Conversation summary embedding generated');

    // Generate embedding for points of interest if any were found
    if (pointsOfInterest.length > 0) {
      const pointsOfInterestText = pointsOfInterest.join(', ');
      console.log('Generating embedding for points of interest...');
      insertData.points_of_interest_embedding = await generateGeminiEmbedding(pointsOfInterestText, geminiApiKey);
      console.log('Points of interest embedding generated');
    } else {
      console.log('No points of interest found, skipping POI embedding');
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
        summary_generated: true,
        summary_preview: generatedSummary.substring(0, 100) + '...',
        points_of_interest_count: pointsOfInterest.length,
        points_of_interest: pointsOfInterest,
        ai_quality_analysis_completed: true,
        analysis_preview: {
          info_accuracy: qualityAnalysis.info_accuracy_status,
          navigation_effectiveness: qualityAnalysis.navigation_effectiveness_status,
          engagement: qualityAnalysis.engagement_interactivity_status,
          satisfaction: qualityAnalysis.user_satisfaction_status
        },
        embeddings_generated: {
          conversation_summary: true,
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
