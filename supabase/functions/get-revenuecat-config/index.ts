import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[GET-REVENUECAT-CONFIG] Function started');

    // Read the public API key from Supabase secrets
    const publicApiKey = Deno.env.get('REVENUECAT_PUBLIC_API_KEY');

    if (!publicApiKey) {
      console.error('[GET-REVENUECAT-CONFIG] Public API key not found in environment variables');
      return new Response(JSON.stringify({ error: 'Public API key not found in environment variables.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log('[GET-REVENUECAT-CONFIG] Public API key found and returned');
    return new Response(JSON.stringify({ publicApiKey }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error('[GET-REVENUECAT-CONFIG] Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});