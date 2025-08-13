import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[APPLE-RECEIPT-VALIDATION] ${step}${detailsStr}`);
};

interface ReceiptValidationResponse {
  status: number;
  latest_receipt_info?: any[];
  pending_renewal_info?: any[];
  receipt?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    logStep("Function started");

    const sharedSecret = Deno.env.get("APPLE_SHARED_SECRET");
    if (!sharedSecret) {
      logStep("ERROR: APPLE_SHARED_SECRET is not set");
      return new Response(JSON.stringify({ error: "Apple configuration missing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Use the service role key to perform writes (upsert) in Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authentication
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
    if (!user?.email) {
      logStep("ERROR: User email not available");
      return new Response(JSON.stringify({ error: "User email not available" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body
    const { receiptData, transactionId, originalTransactionId } = await req.json();
    if (!receiptData) {
      logStep("ERROR: Receipt data missing");
      return new Response(JSON.stringify({ error: "Receipt data required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Validating receipt with Apple", { transactionId });

    // Validate receipt with Apple - try production first, then sandbox
    let validationResponse: ReceiptValidationResponse;
    let isProduction = true;

    try {
      // Production validation
      const prodResponse = await fetch("https://buy.itunes.apple.com/verifyReceipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          "receipt-data": receiptData,
          "password": sharedSecret,
          "exclude-old-transactions": false
        }),
      });

      validationResponse = await prodResponse.json();
      logStep("Production validation response", { status: validationResponse.status });

      // If status is 21007, the receipt is from sandbox, try sandbox endpoint
      if (validationResponse.status === 21007) {
        logStep("Receipt is from sandbox, trying sandbox validation");
        isProduction = false;
        
        const sandboxResponse = await fetch("https://sandbox.itunes.apple.com/verifyReceipt", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            "receipt-data": receiptData,
            "password": sharedSecret,
            "exclude-old-transactions": false
          }),
        });

        validationResponse = await sandboxResponse.json();
        logStep("Sandbox validation response", { status: validationResponse.status });
      }
    } catch (error) {
      logStep("ERROR: Apple receipt validation failed", { error: error.message });
      return new Response(JSON.stringify({ error: "Receipt validation failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Check validation status
    if (validationResponse.status !== 0) {
      logStep("ERROR: Receipt validation failed", { status: validationResponse.status });
      return new Response(JSON.stringify({ 
        error: "Invalid receipt", 
        appleStatus: validationResponse.status 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Receipt validation successful");

    // Extract subscription information
    const latestReceiptInfo = validationResponse.latest_receipt_info || [];
    const pendingRenewalInfo = validationResponse.pending_renewal_info || [];

    // Find the most recent transaction for the user's subscription
    let activeSubscription = null;
    let subscriptionTier = "Basic"; // Default tier
    let subscriptionEnd: string | null = null;
    let cancelAtPeriodEnd = false;

    if (latestReceiptInfo.length > 0) {
      // Sort by expires_date_ms to get the most recent
      const sortedTransactions = latestReceiptInfo.sort((a, b) => 
        parseInt(b.expires_date_ms) - parseInt(a.expires_date_ms)
      );
      
      activeSubscription = sortedTransactions[0];
      subscriptionEnd = new Date(parseInt(activeSubscription.expires_date_ms)).toISOString();
      
      // Check if subscription is still active
      const now = Date.now();
      const isActive = parseInt(activeSubscription.expires_date_ms) > now;
      
      // Check cancellation status from pending renewal info
      if (pendingRenewalInfo.length > 0) {
        const renewalInfo = pendingRenewalInfo[0];
        cancelAtPeriodEnd = renewalInfo.auto_renew_status === "0";
      }

      logStep("Active subscription found", { 
        isActive, 
        subscriptionEnd, 
        cancelAtPeriodEnd,
        originalTransactionId: activeSubscription.original_transaction_id 
      });

      // Create payment record
      await supabaseClient.from("payments").insert({
        tourist_user_id: user.id,
        amount: 799, // Default amount - adjust based on your subscription price
        currency: "usd",
        status: "paid",
        payment_type: "subscription",
        apple_transaction_id: transactionId,
        apple_original_transaction_id: originalTransactionId || activeSubscription.original_transaction_id,
        apple_receipt_data: receiptData,
        metadata: {
          apple_validation_response: validationResponse,
          is_production: isProduction
        }
      });

      // Update subscribers table
      await supabaseClient.from("subscribers").upsert({
        email: user.email,
        user_id: user.id,
        subscribed: isActive,
        subscription_tier: subscriptionTier,
        subscription_end: subscriptionEnd,
        apple_subscription_id: activeSubscription.original_transaction_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });

      logStep("Database updated successfully");

      return new Response(JSON.stringify({
        success: true,
        subscribed: isActive,
        subscription_tier: subscriptionTier,
        subscription_end: subscriptionEnd,
        cancel_at_period_end: cancelAtPeriodEnd
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      logStep("No subscription found in receipt");
      return new Response(JSON.stringify({ 
        error: "No subscription found in receipt" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in apple-receipt-validation", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});