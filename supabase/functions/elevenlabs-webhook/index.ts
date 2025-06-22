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
  if (!Array.isArray(transcript)) return [];
  
  // Only extract text from user messages, not assistant responses
  const userInput = transcript
    .filter(entry => entry.role === 'user' && entry.message)
    .map(entry => entry.message)
    .join(' ');

  if (!userInput.trim()) return [];

  console.log('Extracting points of interest with Gemini AI...');

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

Examples:
- "I want to visit the Statue of Liberty and Times Square" → ["Statue of Liberty", "Times Square"]
- "Take me to Central Park" → ["Central Park"]
- "Where is the Empire State Building?" → ["Empire State Building"]
- "Hello, how are you?" → []

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
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('Invalid Gemini response structure for POI extraction:', data);
      return [];
    }

    const responseText = data.candidates[0].content.parts[0].text.trim();
    console.log('Gemini POI extraction response:', responseText);

    // Parse the JSON response
    try {
      const pointsOfInterest = JSON.parse(responseText);
      if (Array.isArray(pointsOfInterest)) {
        return pointsOfInterest.filter(poi => typeof poi === 'string' && poi.trim().length > 0);
      }
    } catch (parseError) {
      console.error('Failed to parse POI JSON response:', parseError);
      console.log('Raw response:', responseText);
    }

    return [];

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

  // Format conversation for AI analysis
  const conversationText = transcript
    .filter(entry => entry.message && entry.message.trim())
    .map(entry => `${entry.role === 'user' ? 'Tourist' : 'Guide'}: ${entry.message}`)
    .join('\n');

  const userMessageCount = transcript.filter(t => t.role === 'user').length;
  const agentMessageCount = transcript.filter(t => t.role === 'assistant' || t.role === 'agent').length;

  console.log('Analyzing conversation quality with AI...');

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
                text: `Analyze this tour guide conversation and evaluate it across 6 criteria. For each criterion, provide a status (excellent/good/fair/poor) and a 2-3 sentence explanation with specific examples.

CONVERSATION METADATA:
- Duration: ${duration} seconds
- Tourist messages: ${userMessageCount}
- Guide responses: ${agentMessageCount}
- Total turns: ${transcript.length}

EVALUATION CRITERIA:

1. Information Accuracy & Completeness:
Was all factual information provided by the guide accurate and up-to-date? Did the guide provide comprehensive answers to tourist questions about tours, destinations, or related topics?
- Excellent: All information accurate, comprehensive answers with relevant details
- Good: Mostly accurate information, adequately comprehensive responses
- Fair: Generally accurate but some gaps or minor inaccuracies
- Poor: Significant inaccuracies or incomplete information

2. Navigation & Guidance Effectiveness:
Did the guide effectively help the tourist navigate their tour experience? Did it provide clear, actionable directions or recommendations relevant to the tourist's interests?
- Excellent: Clear, specific directions and highly relevant recommendations
- Good: Generally clear guidance with mostly relevant suggestions
- Fair: Basic guidance provided but could be clearer or more specific
- Poor: Confusing directions or irrelevant recommendations

3. Engagement & Interactivity:
Was the conversation engaging and did the guide encourage interaction beyond simple Q&A? Did it maintain a pleasant, helpful tone and feel like a natural conversation?
- Excellent: Highly engaging, descriptive language, natural conversation flow
- Good: Generally engaging with good conversational tone
- Fair: Adequate engagement but somewhat mechanical
- Poor: Robotic, terse responses, poor conversational flow

4. Problem Resolution & Adaptability:
If the tourist encountered problems or needed to adapt plans, did the guide successfully understand issues and offer appropriate solutions?
- Excellent: Quickly identified problems and provided excellent solutions
- Good: Generally good at problem identification and resolution
- Fair: Basic problem-solving with adequate solutions
- Poor: Failed to understand or address problems effectively

5. Efficiency & Conciseness:
Did the guide provide information efficiently without being overly verbose? Did the tourist achieve their goals in reasonable time?
- Excellent: Perfectly concise, direct answers, efficient goal achievement
- Good: Generally efficient with appropriate level of detail
- Fair: Somewhat verbose or inefficient but acceptable
- Poor: Long-winded, repetitive, or required excessive back-and-forth

6. User Satisfaction (Inferred):
Based on tone, language, and successful completion of requests, did the tourist appear satisfied with the interaction and tour experience?
- Excellent: Clear expressions of satisfaction, enthusiasm, gratitude
- Good: Generally positive tone, successful completion of goals
- Fair: Neutral tone, basic goals met
- Poor: Signs of frustration, abrupt ending, unmet goals

CONVERSATION:
${conversationText}

Return ONLY a JSON object with this exact structure:
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
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('Invalid Gemini response structure for quality analysis:', data);
      throw new Error('Invalid API response structure');
    }

    const responseText = data.candidates[0].content.parts[0].text.trim();
    console.log('AI quality analysis response:', responseText.substring(0, 200) + '...');

    // Parse the JSON response
    try {
      const analysis = JSON.parse(responseText);
      
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
      console.log('Raw AI response:', responseText);
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
    .filter(entry => entry.message && entry.message.trim())
    .map(entry => `${entry.role === 'user' ? 'Tourist' : 'Guide'}: ${entry.message}`)
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

    // Generate conversation summary using Gemini
    console.log('Generating conversation summary...');
    const generatedSummary = await generateConversationSummary(transcript, geminiApiKey);
    console.log('Summary generated:', generatedSummary.substring(0, 100) + '...');

    // Extract points of interest mentioned in conversation using Gemini AI
    const pointsOfInterest = await extractPointsOfInterest(transcript, geminiApiKey);
    console.log('Points of interest extracted:', pointsOfInterest);

    // Analyze conversation quality using AI
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
      conversation_summary: generatedSummary, // Use the generated summary instead of the undefined one
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
