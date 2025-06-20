
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
      metadata
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

    // Extract variables from the webhook data (these should contain user_id and destination)
    // Note: Variables might be in different locations depending on ElevenLabs setup
    const variables = webhookData.variables || webhookData.data?.variables || {};
    
    const userId = variables?.user_id;
    const destination = variables?.destination || 'Unknown';

    if (!userId) {
      console.error('No user_id found in webhook variables');
      console.log('Available variables:', JSON.stringify(variables, null, 2));
      return new Response(
        JSON.stringify({ error: 'Missing user_id in variables' }),
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

    // Store the conversation in the database
    console.log('Storing conversation in database...');
    const { data, error } = await supabaseClient
      .from('voice_interactions')
      .insert({
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
        assistant_response_embedding: assistantResponseEmbedding
      })

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
        conversation_id: conversation_id
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
