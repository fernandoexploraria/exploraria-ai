import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client for user authentication
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

// Get secrets from environment variables (configured in Supabase Secrets)
const ISSUER_ID = Deno.env.get('APPLE_APP_CONNECT_ISSUER_ID');
const KEY_ID = Deno.env.get('APPLE_APP_CONNECT_KEY_ID');
const PRIVATE_KEY = Deno.env.get('APPLE_APP_CONNECT_PRIVATE_KEY'); // Content of your .p8 file

// Function to generate a UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Function to base64url encode
function base64urlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Function to sign JWT manually using Web Crypto API
async function signJWT(payload: any, privateKey: string, keyId: string): Promise<string> {
  const header = {
    alg: 'ES256',
    kid: keyId,
    typ: 'JWT'
  };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  // Parse the P8 private key
  const pemKey = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  const keyData = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0));
  
  // Import the key for signing
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false,
    ['sign']
  );

  // Sign the data
  const signature = await crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: 'SHA-256',
    },
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  // Convert signature to base64url
  const signatureArray = new Uint8Array(signature);
  const signatureBase64 = base64urlEncode(String.fromCharCode(...signatureArray));

  return `${signatureInput}.${signatureBase64}`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Authenticate the user calling this function
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), { 
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { 
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { productIdentifier, offerIdentifier, subscriptionGroupIdentifier, applicationUsername } = await req.json();

    console.log('🍎 Generating signature for:', { productIdentifier, offerIdentifier, subscriptionGroupIdentifier });

    if (!productIdentifier || !offerIdentifier || !ISSUER_ID || !KEY_ID || !PRIVATE_KEY) {
      throw new Error('Missing required parameters or server secrets.');
    }

    // Generate a unique nonce for this transaction
    const nonce = generateUUID();
    const timestamp = Date.now(); // Milliseconds since epoch

    // Extract bundle ID from product identifier
    // For product "LEXPS0002", we need the actual bundle ID from your app
    // This should match your app's bundle identifier in Xcode
    const bundleId = "app.lovable.1349ca1f6be14b1d987344f9d88cdaf0"; // Your actual bundle ID

    // Construct the payload for the signature
    const payload = {
      iss: ISSUER_ID, // This should be your App Store Connect Issuer ID, not the private key
      iat: Math.floor(timestamp / 1000), // Timestamp in seconds
      nonce: nonce,
      bid: bundleId,
      productIdentifier: productIdentifier,
      offerIdentifier: offerIdentifier,
      applicationUsername: applicationUsername || user.id, // Use user.id if applicationUsername not provided
    };

    // Add subscription group identifier if provided
    if (subscriptionGroupIdentifier) {
      payload.subscriptionGroupIdentifier = subscriptionGroupIdentifier;
    }

    console.log('🍎 JWT payload:', payload);

    // Sign the payload using the App Store Connect API Key
    const signature = await signJWT(payload, PRIVATE_KEY, KEY_ID);

    console.log('🍎 Generated signature successfully');

    return new Response(JSON.stringify({
      identifier: offerIdentifier,
      keyIdentifier: KEY_ID,
      nonce: nonce,
      signature: signature,
      timestamp: timestamp,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('🍎 Error generating Apple offer signature:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to generate signature.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});