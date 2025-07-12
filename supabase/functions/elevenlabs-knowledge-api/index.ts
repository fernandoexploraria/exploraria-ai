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
    const { action, agentId, text, title, file, url, knowledgeBases } = requestBody;

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
      
      case 'upload_file':
        if (!file || !file.data || !file.name) {
          return new Response(
            JSON.stringify({ error: 'file data and name are required for upload_file action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        return await uploadFileToKnowledgeBase(apiKey, file, title);
      
      case 'upload_url':
        if (!url) {
          return new Response(
            JSON.stringify({ error: 'url is required for upload_url action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        return await uploadUrlToKnowledgeBase(apiKey, url, title);
      
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
      
      case 'update_agent_knowledge':
        if (!agentId || !knowledgeBases) {
          return new Response(
            JSON.stringify({ error: 'agentId and knowledgeBases are required for update_agent_knowledge action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        return await updateAgentKnowledgeBases(apiKey, agentId, knowledgeBases);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Supported: upload_text, upload_file, upload_url, list_knowledge_bases, list_documents, update_agent_knowledge' }),
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
      
      // Handle specific RAG indexing errors
      let errorMessage = responseData.detail || 'RAG index computation failed';
      if (responseData.detail?.includes('rag_limit_exceeded')) {
        errorMessage = 'RAG indexing limit exceeded. Please upgrade your ElevenLabs plan.';
      } else if (responseData.detail?.includes('document_too_small')) {
        errorMessage = 'Document too small for RAG indexing. Please provide more content.';
      }
      
      return {
        success: false,
        error: errorMessage,
        originalError: responseData,
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
      
      // Handle specific ElevenLabs error statuses
      let userMessage = responseData.detail || 'Failed to upload text to ElevenLabs';
      if (responseData.detail?.includes('rag_limit_exceeded')) {
        userMessage = 'You have exceeded your RAG indexing limit. Please upgrade your ElevenLabs plan or try again later.';
      } else if (responseData.detail?.includes('document_too_small')) {
        userMessage = 'The document is too small to index. Please provide more text content.';
      }
      
      return new Response(
        JSON.stringify({
          error: 'ElevenLabs API Error',
          message: userMessage,
          elevenLabsStatus: response.status,
          originalDetail: responseData.detail
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

async function uploadFileToKnowledgeBase(apiKey: string, file: any, title?: string) {
  try {
    console.log('Uploading file to ElevenLabs knowledge base...');
    
    // Convert file data to Blob
    const fileBlob = new Blob([new Uint8Array(file.data)], { type: file.type });
    
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('file', fileBlob, file.name);
    if (title) {
      formData.append('name', title);
    }
    
    const response = await fetch('https://api.elevenlabs.io/v1/convai/knowledge-base/file', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: formData
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('ElevenLabs API Error:', responseData);
      
      let userMessage = responseData.detail || 'Failed to upload file to ElevenLabs';
      if (responseData.detail?.includes('rag_limit_exceeded')) {
        userMessage = 'You have exceeded your RAG indexing limit. Please upgrade your ElevenLabs plan or try again later.';
      } else if (responseData.detail?.includes('document_too_small')) {
        userMessage = 'The document is too small to index. Please provide more content.';
      }
      
      return new Response(
        JSON.stringify({
          error: 'ElevenLabs API Error',
          message: userMessage,
          elevenLabsStatus: response.status,
          originalDetail: responseData.detail
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log('File uploaded successfully:', responseData);
    
    // Compute RAG index after file upload
    const knowledgeBaseId = responseData.knowledge_base_id || responseData.id;
    let ragIndexResult = null;
    
    if (knowledgeBaseId) {
      console.log('Starting RAG index computation for KB:', knowledgeBaseId);
      ragIndexResult = await computeRagIndex(apiKey, knowledgeBaseId);
    }
    
    return new Response(
      JSON.stringify({
        message: knowledgeBaseId ? 'File uploaded and RAG indexing completed' : 'File uploaded but no knowledge base ID returned',
        knowledgeBaseId: knowledgeBaseId,
        status: responseData.status,
        ragIndexResult: ragIndexResult,
        fullResponse: responseData,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Error in uploadFileToKnowledgeBase:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function uploadUrlToKnowledgeBase(apiKey: string, url: string, title?: string) {
  try {
    console.log('Uploading URL to ElevenLabs knowledge base...');
    
    const response = await fetch('https://api.elevenlabs.io/v1/convai/knowledge-base/url', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        url,
        ...(title && { name: title })
      })
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('ElevenLabs API Error:', responseData);
      
      let userMessage = responseData.detail || 'Failed to upload URL to ElevenLabs';
      
      return new Response(
        JSON.stringify({
          error: 'ElevenLabs API Error',
          message: userMessage,
          elevenLabsStatus: response.status,
          originalDetail: responseData.detail
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log('URL uploaded successfully:', responseData);
    
    // Compute RAG index after URL upload
    const knowledgeBaseId = responseData.knowledge_base_id || responseData.id;
    let ragIndexResult = null;
    
    if (knowledgeBaseId) {
      console.log('Starting RAG index computation for URL KB:', knowledgeBaseId);
      ragIndexResult = await computeRagIndex(apiKey, knowledgeBaseId);
    }
    
    return new Response(
      JSON.stringify({
        message: knowledgeBaseId ? 'URL uploaded and RAG indexing completed' : 'URL uploaded but no knowledge base ID returned',
        knowledgeBaseId: knowledgeBaseId,
        status: responseData.status,
        ragIndexResult: ragIndexResult,
        fullResponse: responseData,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Error in uploadUrlToKnowledgeBase:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function updateAgentKnowledgeBases(apiKey: string, agentId: string, knowledgeBases: any[]) {
  try {
    console.log('Updating agent knowledge bases for agent:', agentId);
    console.log('Knowledge bases to add:', knowledgeBases);
    
    // Validate inputs
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!knowledgeBases || !Array.isArray(knowledgeBases) || knowledgeBases.length === 0) {
      throw new Error('Knowledge bases array is required and must not be empty');
    }
    
    // First get the current agent configuration
    const agentResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      }
    });

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      console.error('Failed to get agent:', errorText);
      throw new Error(`Failed to get agent: ${agentResponse.status} ${errorText}`);
    }

    const agentData = await agentResponse.json();
    console.log('Current agent data retrieved successfully');
    
    // Use the exact same format as the playground
    const knowledgeBaseIds = knowledgeBases.map(kb => kb.id);
    
    // Update agent with knowledge bases using PATCH to conversation_config.agent.prompt
    const updatePayload = {
      conversation_config: {
        agent: {
          prompt: {
            knowledge_base: knowledgeBaseIds
          }
        }
      }
    };
    
    const updateResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload)
    });
    
    const updateResponseData = await updateResponse.json();
    
    if (!updateResponse.ok) {
      console.error('Failed to update agent:', updateResponseData);
      throw new Error(`Failed to update agent: ${updateResponse.status} ${JSON.stringify(updateResponseData)}`);
    }
    
    console.log('Agent updated successfully with knowledge bases');
    
    return new Response(
      JSON.stringify({
        message: 'Agent updated successfully with knowledge bases',
        agentId: agentId,
        knowledgeBasesAdded: knowledgeBases.length,
        updatedAgent: updateResponseData
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Error updating agent knowledge bases:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}