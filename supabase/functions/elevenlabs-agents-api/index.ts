import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log('ElevenLabs Agents API function loaded - Version 2.0 with duplicate support');

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
    const { action, agentId } = requestBody;
    
    // COMPREHENSIVE DEBUGGING - Force redeployment
    console.log('=== ELEVENLABS AGENTS API DEBUG v2.1 ===');
    console.log('Request body:', JSON.stringify(requestBody));
    console.log('Extracted action:', action);
    console.log('Extracted agentId:', agentId);
    console.log('Action type:', typeof action);
    console.log('Action === "duplicate_agent":', action === 'duplicate_agent');
    console.log('Available cases: list_agents, get_agent, duplicate_agent');

    switch (action) {
      case 'list_agents':
        console.log('Executing list_agents case');
        return await listAgents(apiKey);
      
      case 'get_agent':
        console.log('Executing get_agent case');
        if (!agentId) {
          console.log('Error: agentId missing for get_agent');
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
        console.log('SUCCESS: Executing duplicate_agent case!');
        if (!agentId) {
          console.log('Error: agentId missing for duplicate_agent');
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
        console.log('ERROR: Hit default case with action:', action);
        console.log('This means duplicate_agent case was not matched');
        return new Response(
          JSON.stringify({ 
            error: 'Invalid action. Supported actions: list_agents, get_agent, duplicate_agent',
            received_action: action,
            action_type: typeof action,
            debug_timestamp: new Date().toISOString()
          }),
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
    
    // Use the dedicated duplicate endpoint - much simpler!
    const duplicateResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${sourceAgentId}/duplicate`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });

    console.log(`Duplicate response status: ${duplicateResponse.status}`);
    
    if (!duplicateResponse.ok) {
      const errorText = await duplicateResponse.text();
      console.error(`Failed to duplicate agent: ${duplicateResponse.status} ${errorText}`);
      throw new Error(`Failed to duplicate agent: ${duplicateResponse.status} ${errorText}`);
    }

    const duplicatedAgent = await duplicateResponse.json();
    console.log(`Successfully duplicated agent with ID: ${duplicatedAgent.agent_id}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Agent duplicated successfully',
        source_agent_id: sourceAgentId,
        agent_id: duplicatedAgent.agent_id,
        agent_url: duplicatedAgent.agent_url || `https://elevenlabs.io/convai/agents/${duplicatedAgent.agent_id}`,
        name: duplicatedAgent.name || 'Duplicated Agent'
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