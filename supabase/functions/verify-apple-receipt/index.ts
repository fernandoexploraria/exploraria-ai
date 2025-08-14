import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-APPLE-RECEIPT] ${step}${detailsStr}`);
};

interface AppleReceiptResponse {
  status: number;
  latest_receipt_info?: Array<{
    original_transaction_id: string;
    transaction_id: string;
    product_id: string;
    expires_date_ms?: string;
    is_trial_period?: string;
  }>;
  pending_renewal_info?: Array<{
    auto_renew_status: string;
    product_id: string;
  }>;
}

const verifyReceiptWithApple = async (receiptData: string, isProduction: boolean): Promise<AppleReceiptResponse> => {
  const appleUrl = isProduction 
    ? 'https://buy.itunes.apple.com/verifyReceipt'
    : 'https://sandbox.itunes.apple.com/verifyReceipt';
    
  const sharedSecret = Deno.env.get("APPLE_SHARED_SECRET");
  if (!sharedSecret) {
    throw new Error("APPLE_SHARED_SECRET is not configured");
  }

  const response = await fetch(appleUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      'receipt-data': receiptData,
      'password': sharedSecret,
      'exclude-old-transactions': true
    }),
  });

  if (!response.ok) {
    throw new Error(`Apple verification failed with status: ${response.status}`);
  }

  return await response.json();
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { receiptData } = await req.json();
    if (!receiptData) {
      throw new Error("Receipt data is required");
    }
    logStep("Receipt data received");

    // Try production first, then sandbox if needed
    let appleResponse: AppleReceiptResponse;
    try {
      appleResponse = await verifyReceiptWithApple(receiptData, true);
      if (appleResponse.status === 21007) {
        // Production receipt sent to sandbox, try sandbox
        logStep("Switching to sandbox verification");
        appleResponse = await verifyReceiptWithApple(receiptData, false);
      }
    } catch (error) {
      logStep("Production verification failed, trying sandbox");
      appleResponse = await verifyReceiptWithApple(receiptData, false);
    }

    logStep("Apple verification response", { status: appleResponse.status });

    if (appleResponse.status !== 0) {
      throw new Error(`Apple verification failed with status: ${appleResponse.status}`);
    }

    // Check for active LEXPS0001 subscription
    const latestReceipts = appleResponse.latest_receipt_info || [];
    const lexpsReceipts = latestReceipts.filter(receipt => receipt.product_id === 'LEXPS0001');
    
    let isSubscribed = false;
    let subscriptionEnd = null;
    let originalTransactionId = null;
    let latestTransactionId = null;

    if (lexpsReceipts.length > 0) {
      // Get the most recent transaction
      const latestReceipt = lexpsReceipts[lexpsReceipts.length - 1];
      originalTransactionId = latestReceipt.original_transaction_id;
      latestTransactionId = latestReceipt.transaction_id;
      
      if (latestReceipt.expires_date_ms) {
        const expirationDate = new Date(parseInt(latestReceipt.expires_date_ms));
        subscriptionEnd = expirationDate.toISOString();
        isSubscribed = expirationDate > new Date();
        
        logStep("Subscription details", {
          expirationDate: subscriptionEnd,
          isActive: isSubscribed,
          originalTransactionId,
          latestTransactionId
        });
      }
    }

    // Update subscribers table
    const { error: upsertError } = await supabaseClient
      .from("subscribers")
      .upsert({
        email: user.email,
        user_id: user.id,
        subscribed: isSubscribed,
        subscription_platform: 'apple',
        subscription_tier: isSubscribed ? 'Premium' : null,
        subscription_end: subscriptionEnd,
        apple_original_transaction_id: originalTransactionId,
        latest_transaction_id: latestTransactionId,
        apple_receipt_data: receiptData,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });

    if (upsertError) {
      logStep("Database upsert error", { error: upsertError });
      throw new Error(`Failed to update subscription data: ${upsertError.message}`);
    }

    logStep("Successfully updated subscription data", {
      subscribed: isSubscribed,
      subscriptionEnd
    });

    return new Response(JSON.stringify({
      success: true,
      subscribed: isSubscribed,
      subscription_tier: isSubscribed ? 'Premium' : null,
      subscription_end: subscriptionEnd,
      subscription_platform: 'apple'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in verify-apple-receipt", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});