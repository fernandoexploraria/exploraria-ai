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

    const { action, agentId } = await req.json();

    switch (action) {
      case 'list_agents':
        return await listAgents(apiKey);
      
      case 'get_agent':
        if (!agentId) {
          return new Response(
            JSON.stringify({ error: 'agentId is required for get_agent action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        return await getAgent(apiKey, agentId);
      
      case 'duplicate_agent':
        if (!agentId) {
          return new Response(
            JSON.stringify({ error: 'agentId is required for duplicate_agent action' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        return await duplicateAgent(apiKey, agentId);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Supported: list_agents, get_agent, duplicate_agent' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
    }
  } catch (error) {
    console.error('Error in elevenlabs-agents-api:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function listAgents(apiKey: string) {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list agents: ${response.status} ${errorText}`);
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
    console.error('Error listing agents:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

async function getAgent(apiKey: string, agentId: string) {
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get agent: ${response.status} ${errorText}`);
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
    console.error('Error getting agent:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

async function duplicateAgent(apiKey: string, sourceAgentId: string) {
  try {
    console.log(`Starting agent duplication for agent: ${sourceAgentId}`);
    
    // First, get the source agent configuration
    const sourceResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${sourceAgentId}`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      }
    });

    if (!sourceResponse.ok) {
      const errorText = await sourceResponse.text();
      console.error(`Failed to get source agent: ${sourceResponse.status} ${errorText}`);
      throw new Error(`Failed to get source agent: ${sourceResponse.status} ${errorText}`);
    }

    const sourceAgent = await sourceResponse.json();
    console.log(`Retrieved source agent: ${sourceAgent.name}`);
    
    // Create a new agent with the same configuration but a different name
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const newAgentData = {
      name: `${sourceAgent.name} (Copy ${timestamp})`,
      conversation_config: sourceAgent.conversation_config
    };

    console.log(`Creating new agent with name: ${newAgentData.name}`);

    // Create the new agent
    const createResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newAgentData)
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error(`Failed to create duplicate agent: ${createResponse.status} ${errorText}`);
      throw new Error(`Failed to create duplicate agent: ${createResponse.status} ${errorText}`);
    }

    const newAgent = await createResponse.json();
    console.log(`Successfully created duplicate agent with ID: ${newAgent.agent_id}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Agent duplicated successfully',
        source_agent_id: sourceAgentId,
        agent_id: newAgent.agent_id,
        agent_url: newAgent.agent_url,
        name: newAgentData.name
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error duplicating agent:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}