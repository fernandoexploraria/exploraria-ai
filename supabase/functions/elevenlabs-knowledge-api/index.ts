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

    const requestBody = await req.json();
    const { action, agentId, knowledgeBaseId, documentData, files, documentId } = requestBody;

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
      
      case 'upload_files_to_kb':
        if (!files || !Array.isArray(files) || !knowledgeBaseId) {
          return new Response(
            JSON.stringify({ error: 'files array and knowledgeBaseId are required for upload_files_to_kb action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        return await uploadFilesToKnowledgeBase(apiKey, knowledgeBaseId, files);
      
      case 'associate_kb_to_agent':
        if (!agentId || !knowledgeBaseId) {
          return new Response(
            JSON.stringify({ error: 'agentId and knowledgeBaseId are required for associate_kb_to_agent action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        return await associateKnowledgeBaseToAgent(apiKey, agentId, knowledgeBaseId);
      
      case 'get_or_create_kb':
        if (!agentId) {
          return new Response(
            JSON.stringify({ error: 'agentId is required for get_or_create_kb action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        return await getOrCreateKnowledgeBase(apiKey, agentId);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Supported: list_knowledge_bases, list_documents, create_knowledge_base, upload_files_to_kb, associate_kb_to_agent, get_or_create_kb' }),
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

async function uploadFilesToKnowledgeBase(apiKey: string, knowledgeBaseId: string, files: Array<{name: string, content: string, title: string}>) {
  try {
    console.log('Starting file upload to knowledge base:', knowledgeBaseId, 'for', files.length, 'files');
    const uploadResults = [];
    
    for (const file of files) {
      console.log('Processing file:', file.name);
      
      try {
        // Convert base64 content to Uint8Array
        const base64Data = file.content.includes(',') ? file.content.split(',')[1] : file.content;
        
        // Decode base64 to bytes
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Create form data using Deno's FormData
        const formData = new FormData();
        const fileBlob = new Blob([bytes]);
        formData.append('file', fileBlob, file.name);
        formData.append('name', file.title || file.name); // Use title as document name
        
        console.log('Uploading file to ElevenLabs KB:', file.name);
        const response = await fetch(`https://api.elevenlabs.io/v1/knowledge-base/${knowledgeBaseId}/documents`, {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
          },
          body: formData
        });

        console.log('Upload response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Upload failed:', errorText);
          uploadResults.push({
            file: file.name,
            title: file.title,
            success: false,
            error: `Upload failed: ${response.status} ${errorText}`
          });
          continue;
        }

        const responseText = await response.text();
        console.log('Upload response body:', responseText);
        
        let uploadData;
        try {
          uploadData = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse response as JSON:', parseError);
          uploadResults.push({
            file: file.name,
            title: file.title,
            success: false,
            error: `Invalid JSON response: ${responseText}`
          });
          continue;
        }
        
        const documentId = uploadData.document_id || uploadData.id;
        if (!documentId) {
          console.error('No document ID found in response:', uploadData);
          uploadResults.push({
            file: file.name,
            title: file.title,
            success: false,
            error: 'No document ID returned from upload'
          });
          continue;
        }

        uploadResults.push({
          file: file.name,
          title: file.title,
          document_id: documentId,
          success: true
        });
        
        console.log('Successfully uploaded:', file.name, 'with ID:', documentId);
      } catch (fileError) {
        console.error('Error uploading file:', file.name, fileError);
        uploadResults.push({
          file: file.name,
          title: file.title,
          success: false,
          error: fileError.message
        });
      }
    }
    
    console.log('Upload process complete. Results:', uploadResults);
    return new Response(
      JSON.stringify({ uploadResults }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in uploadFilesToKnowledgeBase function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

async function associateKnowledgeBaseToAgent(apiKey: string, agentId: string, knowledgeBaseId: string) {
  try {
    console.log('Associating knowledge base to agent:', agentId, 'KB:', knowledgeBaseId);
    
    // First get the current agent configuration
    const getAgentResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      }
    });

    if (!getAgentResponse.ok) {
      const errorText = await getAgentResponse.text();
      throw new Error(`Failed to get agent: ${getAgentResponse.status} ${errorText}`);
    }

    const agentData = await getAgentResponse.json();
    console.log('Retrieved agent data for update');
    
    // Update the agent with the knowledge base ID
    const updatePayload = {
      name: agentData.name,
      description: agentData.description,
      system_prompt: agentData.system_prompt,
      conversation_config: agentData.conversation_config,
      platform_settings: agentData.platform_settings,
      voice_id: agentData.voice_id,
      knowledge_base_id: knowledgeBaseId // This is the key parameter
    };

    console.log('Updating agent with knowledge base...');
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to associate knowledge base to agent: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('Successfully associated knowledge base to agent');
    
    return new Response(
      JSON.stringify({ 
        success: true,
        agent_id: agentId,
        knowledge_base_id: knowledgeBaseId,
        updated_agent: data
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error associating knowledge base to agent:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

async function getOrCreateKnowledgeBase(apiKey: string, agentId: string) {
  try {
    console.log('Getting or creating knowledge base for agent:', agentId);
    
    // First check if agent already has a knowledge base
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
    
    if (agentData.knowledge_base_id) {
      console.log('Agent already has knowledge base:', agentData.knowledge_base_id);
      return new Response(
        JSON.stringify({ 
          knowledge_base_id: agentData.knowledge_base_id,
          exists: true
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create a new knowledge base
    console.log('Creating new knowledge base for agent');
    const createKbResponse = await fetch('https://api.elevenlabs.io/v1/knowledge-base', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Knowledge Base for ${agentData.name}`,
        description: `Auto-created knowledge base for agent ${agentData.name}`
      })
    });

    if (!createKbResponse.ok) {
      const errorText = await createKbResponse.text();
      throw new Error(`Failed to create knowledge base: ${createKbResponse.status} ${errorText}`);
    }

    const kbData = await createKbResponse.json();
    const knowledgeBaseId = kbData.knowledge_base_id || kbData.id;
    
    console.log('Created knowledge base:', knowledgeBaseId);
    
    return new Response(
      JSON.stringify({ 
        knowledge_base_id: knowledgeBaseId,
        exists: false,
        created: true
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in getOrCreateKnowledgeBase:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}