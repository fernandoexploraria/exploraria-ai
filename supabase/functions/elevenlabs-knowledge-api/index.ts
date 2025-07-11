import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    // Create Supabase client with service role key to verify user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: user, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Handle JSON requests
    const requestBody = await req.json();
    const { action, agentId, text, title } = requestBody;

    switch (action) {
      case 'upload_text':
        if (!text) {
          return new Response(
            JSON.stringify({ error: 'text is required for upload_text action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        return await uploadTextToKnowledgeBase(apiKey, text, title);
      
      case 'list_knowledge_bases':
        return await listKnowledgeBases(apiKey);
      
      case 'list_documents':
        if (!agentId) {
          return new Response(
            JSON.stringify({ error: 'agentId is required for list_documents action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        return await listAgentDocuments(apiKey, agentId);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Supported: upload_text, list_knowledge_bases, list_documents' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
    }
  } catch (error) {
    console.error('Error in elevenlabs-knowledge-api:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        details: error.stack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function listKnowledgeBases(apiKey: string) {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/knowledge-base', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list knowledge bases: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    return new Response(
      JSON.stringify(data),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error listing knowledge bases:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

async function computeRagIndex(apiKey: string, knowledgeBaseId: string) {
  try {
    console.log('Computing RAG index for knowledge base:', knowledgeBaseId);
    
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/knowledge-base/${knowledgeBaseId}/rag-index`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'e5_mistral_7b_instruct'
      })
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('RAG index computation failed:', response.status, responseData);
      return {
        success: false,
        error: responseData,
        status: response.status
      };
    }
    
    console.log('RAG index computation started successfully:', responseData);
    return {
      success: true,
      data: responseData
    };
    
  } catch (error) {
    console.error('Error computing RAG index:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function listAgentDocuments(apiKey: string, agentId: string) {
  try {
    // First get the agent to see its knowledge base configuration
    const agentResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      }
    });

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      throw new Error(`Failed to get agent: ${agentResponse.status} ${errorText}`);
    }

    const agentData = await agentResponse.json();
    
    // Extract knowledge base from agent configuration
    const knowledgeBase = agentData.conversation_config?.knowledge_base || {};
    const knowledgeBaseId = knowledgeBase.knowledge_base_id;
    
    if (!knowledgeBaseId) {
      return new Response(
        JSON.stringify({ 
          agent_id: agentId,
          knowledge_base: null,
          documents: [],
          message: 'No knowledge base configured for this agent'
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get documents from the knowledge base
    const documentsResponse = await fetch(`https://api.elevenlabs.io/v1/knowledge-base/${knowledgeBaseId}`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      }
    });

    if (!documentsResponse.ok) {
      const errorText = await documentsResponse.text();
      throw new Error(`Failed to get knowledge base documents: ${documentsResponse.status} ${errorText}`);
    }

    const documentsData = await documentsResponse.json();
    
    return new Response(
      JSON.stringify({ 
        agent_id: agentId,
        knowledge_base_id: knowledgeBaseId,
        knowledge_base_config: knowledgeBase,
        documents: documentsData.documents || [],
        total_documents: documentsData.documents?.length || 0
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error listing agent documents:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

async function uploadTextToKnowledgeBase(apiKey: string, text: string, title?: string) {
  try {
    console.log('Uploading text to ElevenLabs knowledge base...');
    
    const response = await fetch('https://api.elevenlabs.io/v1/convai/knowledge-base/text', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text,
        ...(title && { name: title })
      })
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('ElevenLabs API Error:', responseData);
      return new Response(
        JSON.stringify({
          error: 'ElevenLabs API Error',
          message: responseData.detail || 'Failed to upload text to ElevenLabs',
          elevenLabsStatus: response.status,
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log('Text uploaded successfully:', responseData);
    
    // Compute RAG index synchronously 
    const knowledgeBaseId = responseData.knowledge_base_id || responseData.id;
    let ragIndexResult = null;
    
    if (knowledgeBaseId) {
      console.log('Starting RAG index computation for KB:', knowledgeBaseId);
      ragIndexResult = await computeRagIndex(apiKey, knowledgeBaseId);
    } else {
      console.error('No knowledge base ID returned from ElevenLabs:', responseData);
    }
    
    return new Response(
      JSON.stringify({
        message: knowledgeBaseId ? 'Text uploaded and RAG indexing completed' : 'Text uploaded but no knowledge base ID returned',
        knowledgeBaseId: knowledgeBaseId,
        status: responseData.status,
        ragIndexResult: ragIndexResult,
        fullResponse: responseData, // Include full response for debugging
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Error in uploadTextToKnowledgeBase:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}