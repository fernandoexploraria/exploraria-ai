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
      
      case 'upload_files':
        if (!files || !Array.isArray(files)) {
          return new Response(
            JSON.stringify({ error: 'files array is required for upload_files action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        return await uploadFiles(apiKey, files);
      
      case 'process_rag_index':
        if (!documentId) {
          return new Response(
            JSON.stringify({ error: 'documentId is required for process_rag_index action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        return await processRagIndex(apiKey, documentId);
      
      case 'associate_documents_to_agent':
        if (!agentId || !documentData) {
          return new Response(
            JSON.stringify({ error: 'agentId and documentData are required for associate_documents_to_agent action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        return await associateDocumentsToAgent(apiKey, agentId, documentData);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Supported: list_knowledge_bases, list_documents, create_knowledge_base, upload_files, process_rag_index, associate_documents_to_agent' }),
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

async function uploadFiles(apiKey: string, files: Array<{name: string, content: string, title: string}>) {
  try {
    console.log('Starting file upload process for', files.length, 'files');
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
        
        console.log('Uploading file to ElevenLabs:', file.name);
        const response = await fetch('https://api.elevenlabs.io/v1/convai/knowledge-base/file', {
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
          throw new Error(`Failed to upload file ${file.name}: ${response.status} ${errorText}`);
        }

        const responseText = await response.text();
        console.log('Upload response body:', responseText);
        
        let uploadData;
        try {
          uploadData = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse response as JSON:', parseError);
          throw new Error(`Invalid JSON response: ${responseText}`);
        }
        
        const documentId = uploadData.document_id || uploadData.id || uploadData.knowledgeBaseId;
        if (!documentId) {
          console.error('No document ID found in response:', uploadData);
          throw new Error('No document ID returned from upload');
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
          document_id: null,
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
    console.error('Error in uploadFiles function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

async function processRagIndex(apiKey: string, documentId: string) {
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/knowledge-base/${documentId}/rag-index`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'e5_mistral_7b_instruct'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to process RAG index for document ${documentId}: ${response.status} ${errorText}`);
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
    console.error('Error processing RAG index:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

async function associateDocumentsToAgent(apiKey: string, agentId: string, documentData: any) {
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(documentData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to associate documents to agent ${agentId}: ${response.status} ${errorText}`);
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
    console.error('Error associating documents to agent:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}