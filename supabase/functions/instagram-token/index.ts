
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code } = await req.json();
    
    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Authorization code is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const clientId = Deno.env.get('INSTAGRAM_CLIENT_ID');
    const clientSecret = Deno.env.get('INSTAGRAM_CLIENT_SECRET');
    const redirectUri = `${req.headers.get('origin')}/auth/instagram/callback`;

    if (!clientId || !clientSecret) {
      console.error('Missing Instagram credentials');
      return new Response(
        JSON.stringify({ error: 'Instagram credentials not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Exchanging Instagram code for token...');

    // Step 1: Exchange code for short-lived access token
    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Instagram token exchange failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange code for token' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('Short-lived token obtained');

    // Step 2: Exchange short-lived token for long-lived token
    const longLivedResponse = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${tokenData.access_token}`, {
      method: 'GET',
    });

    if (!longLivedResponse.ok) {
      console.error('Failed to get long-lived token');
      // Return short-lived token if long-lived exchange fails
      return new Response(
        JSON.stringify({ access_token: tokenData.access_token }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const longLivedData = await longLivedResponse.json();
    console.log('Long-lived token obtained');

    return new Response(
      JSON.stringify({ access_token: longLivedData.access_token }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Instagram token exchange error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
