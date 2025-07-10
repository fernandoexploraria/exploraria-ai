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

    const { action, agentId, knowledgeBaseId, documentData } = await req.json();

    switch (action) {
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
      
      case 'create_knowledge_base':
        if (!documentData) {
          return new Response(
            JSON.stringify({ error: 'documentData is required for create_knowledge_base action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        return await createKnowledgeBase(apiKey, documentData);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Supported: list_knowledge_bases, list_documents, create_knowledge_base' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
    }
  } catch (error) {
    console.error('Error in elevenlabs-knowledge-api:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
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

async function createKnowledgeBase(apiKey: string, knowledgeBaseData: any) {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/knowledge-base', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(knowledgeBaseData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create knowledge base: ${response.status} ${errorText}`);
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
    console.error('Error creating knowledge base:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}