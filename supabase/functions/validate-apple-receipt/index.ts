import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VALIDATE-APPLE-RECEIPT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Get the Apple shared secret
    const appleSharedSecret = Deno.env.get('APPLE_SHARED_SECRET');
    if (!appleSharedSecret) {
      logStep("ERROR: Apple shared secret not found");
      return new Response(JSON.stringify({ error: 'Apple shared secret not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No authorization header provided");
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      logStep("ERROR: Authentication failed", { error: userError?.message });
      return new Response(JSON.stringify({ error: "Invalid authentication token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body
    const { receiptData, sandbox = true } = await req.json();
    
    if (!receiptData) {
      logStep("ERROR: No receipt data provided");
      return new Response(JSON.stringify({ error: 'Receipt data is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    logStep("Validating receipt with Apple", { sandbox });

    // Apple receipt validation endpoint
    const appleEndpoint = sandbox 
      ? 'https://sandbox.itunes.apple.com/verifyReceipt'
      : 'https://buy.itunes.apple.com/verifyReceipt';

    // Validate receipt with Apple
    const appleResponse = await fetch(appleEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'receipt-data': receiptData,
        'password': appleSharedSecret,
        'exclude-old-transactions': true
      }),
    });

    const validationResult = await appleResponse.json();
    logStep("Apple validation response", { status: validationResult.status });

    // Handle validation result
    if (validationResult.status === 0) {
      // Valid receipt
      const receipt = validationResult.receipt;
      const latestReceiptInfo = validationResult.latest_receipt_info;
      
      logStep("Receipt validation successful", { 
        bundleId: receipt.bundle_id,
        transactionCount: latestReceiptInfo?.length || 0 
      });

      // Check for active subscriptions
      let isSubscribed = false;
      let subscriptionEnd = null;
      let originalTransactionId = null;
      let latestTransactionId = null;

      if (latestReceiptInfo && latestReceiptInfo.length > 0) {
        // Get the latest subscription info
        const latestTransaction = latestReceiptInfo[latestReceiptInfo.length - 1];
        originalTransactionId = latestTransaction.original_transaction_id;
        latestTransactionId = latestTransaction.transaction_id;
        
        // Check if subscription is still active
        const expiresDate = new Date(parseInt(latestTransaction.expires_date_ms));
        const now = new Date();
        
        isSubscribed = expiresDate > now;
        subscriptionEnd = expiresDate.toISOString();
        
        logStep("Subscription details", {
          isSubscribed,
          subscriptionEnd,
          originalTransactionId,
          latestTransactionId
        });
      }

      // Update subscriber record in Supabase
      const { error: updateError } = await supabaseClient
        .from('subscribers')
        .upsert({
          email: user.email,
          user_id: user.id,
          subscribed: isSubscribed,
          subscription_tier: isSubscribed ? 'Premium' : null,
          subscription_end: subscriptionEnd,
          subscription_platform: 'apple',
          original_transaction_id: originalTransactionId,
          latest_transaction_id: latestTransactionId,
          apple_receipt_data: receiptData,
          updated_at: new Date().toISOString(),
        }, { 
          onConflict: 'email' 
        });

      if (updateError) {
        logStep("ERROR: Failed to update subscriber record", { error: updateError.message });
        return new Response(JSON.stringify({ error: 'Failed to update subscription status' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      logStep("Subscriber record updated successfully");

      return new Response(JSON.stringify({
        valid: true,
        subscribed: isSubscribed,
        subscription_end: subscriptionEnd,
        subscription_platform: 'apple'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });

    } else if (validationResult.status === 21007) {
      // Receipt is from sandbox but sent to production - retry with sandbox
      logStep("Receipt is sandbox, retrying with sandbox endpoint");
      
      if (!sandbox) {
        // Recursively call with sandbox = true
        return await fetch(req.url, {
          method: 'POST',
          headers: req.headers,
          body: JSON.stringify({ receiptData, sandbox: true })
        });
      }
    }

    // Invalid receipt or other error
    logStep("Receipt validation failed", { 
      status: validationResult.status, 
      error: getAppleErrorMessage(validationResult.status) 
    });

    return new Response(JSON.stringify({
      valid: false,
      error: getAppleErrorMessage(validationResult.status),
      status: validationResult.status
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    logStep("ERROR in validate-apple-receipt", { message: error.message });
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});

function getAppleErrorMessage(status: number): string {
  const errorMessages: { [key: number]: string } = {
    21000: 'The App Store could not read the JSON object you provided.',
    21002: 'The data in the receipt-data property was malformed or missing.',
    21003: 'The receipt could not be authenticated.',
    21004: 'The shared secret you provided does not match the shared secret on file for your account.',
    21005: 'The receipt server is not currently available.',
    21006: 'This receipt is valid but the subscription has expired.',
    21007: 'This receipt is from the sandbox environment.',
    21008: 'This receipt is from the production environment.',
    21010: 'This receipt could not be authorized.'
  };
  
  return errorMessages[status] || `Unknown error: ${status}`;
}