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
  receipt?: any;
  latest_receipt_info?: any[];
  pending_renewal_info?: any[];
  is_in_billing_retry_period?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { receiptData, isProduction = false } = await req.json();
    if (!receiptData) throw new Error("Receipt data is required");
    logStep("Receipt data received", { isProduction });

    const appleSharedSecret = Deno.env.get("APPLE_SHARED_SECRET");
    if (!appleSharedSecret) throw new Error("APPLE_SHARED_SECRET not configured");

    // Apple receipt validation endpoints
    const sandboxUrl = "https://sandbox.itunes.apple.com/verifyReceipt";
    const productionUrl = "https://buy.itunes.apple.com/verifyReceipt";
    
    let verificationUrl = isProduction ? productionUrl : sandboxUrl;
    
    const requestBody = {
      "receipt-data": receiptData,
      "password": appleSharedSecret,
      "exclude-old-transactions": true
    };

    logStep("Sending request to Apple", { url: verificationUrl });

    let response = await fetch(verificationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    let result: AppleReceiptResponse = await response.json();
    logStep("Apple response received", { status: result.status });

    // If sandbox receipt was sent to production, try sandbox
    if (result.status === 21007 && isProduction) {
      logStep("Retrying with sandbox URL");
      response = await fetch(sandboxUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      result = await response.json();
      logStep("Sandbox response received", { status: result.status });
    }

    if (result.status !== 0) {
      throw new Error(`Apple receipt validation failed with status: ${result.status}`);
    }

    // Parse subscription information
    const latestReceiptInfo = result.latest_receipt_info || [];
    const activeSubscriptions = latestReceiptInfo.filter(transaction => {
      const expiresDate = new Date(parseInt(transaction.expires_date_ms));
      return expiresDate > new Date() && transaction.product_id === 'LEXPS0001';
    });

    const hasActiveSubscription = activeSubscriptions.length > 0;
    let subscriptionEnd = null;
    let originalTransactionId = null;

    if (hasActiveSubscription) {
      const latestTransaction = activeSubscriptions[0];
      subscriptionEnd = new Date(parseInt(latestTransaction.expires_date_ms)).toISOString();
      originalTransactionId = latestTransaction.original_transaction_id;
      logStep("Active subscription found", { 
        expiresAt: subscriptionEnd,
        originalTransactionId 
      });
    }

    // Update subscribers table
    await supabaseClient.from("subscribers").upsert({
      email: user.email,
      user_id: user.id,
      subscribed: hasActiveSubscription,
      subscription_platform: 'apple',
      subscription_tier: hasActiveSubscription ? 'Premium' : null,
      subscription_end: subscriptionEnd,
      apple_original_transaction_id: originalTransactionId,
      apple_receipt_data: receiptData,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' });

    logStep("Database updated", { 
      subscribed: hasActiveSubscription, 
      subscriptionEnd 
    });

    return new Response(JSON.stringify({
      success: true,
      subscribed: hasActiveSubscription,
      subscription_tier: hasActiveSubscription ? 'Premium' : null,
      subscription_end: subscriptionEnd,
      platform: 'apple'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});