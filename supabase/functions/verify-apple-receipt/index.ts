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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    logStep("Function started");

    const appleSharedSecret = Deno.env.get("APPLE_SHARED_SECRET");
    if (!appleSharedSecret) throw new Error("APPLE_SHARED_SECRET is not set");
    logStep("Apple shared secret verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { receiptData, productId, transactionId, originalTransactionId } = await req.json();

    if (!receiptData || !productId) {
      return new Response(JSON.stringify({ error: 'Missing required receipt data or product ID for validation.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Apple's receipt validation endpoints
    const productionUrl = 'https://buy.itunes.apple.com/verifyReceipt';
    const sandboxUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';

    const requestBody = {
      'receipt-data': receiptData,
      password: appleSharedSecret,
      'exclude-old-transactions': true,
    };

    let response: Response;
    let jsonResponse: any;

    // Try production first, then sandbox if needed
    try {
      logStep("Attempting production validation");
      response = await fetch(productionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      jsonResponse = await response.json();

      if (jsonResponse.status === 21007) {
        logStep('Receipt is from sandbox environment. Retrying validation with sandbox URL...');
        response = await fetch(sandboxUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        jsonResponse = await response.json();
      }
    } catch (fetchError) {
      logStep('Error fetching from Apple verifyReceipt endpoint', { error: fetchError });
      return new Response(JSON.stringify({ isValid: false, error: 'Failed to communicate with Apple validation servers.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logStep('Apple Receipt Validation Response', { status: jsonResponse.status });

    if (jsonResponse.status === 0) {
      let isValid = false;
      let expiresDate: Date | null = null;
      let newStatus = 'inactive';

      if (jsonResponse.latest_receipt_info && jsonResponse.latest_receipt_info.length > 0) {
        const latestTransactionForProduct = jsonResponse.latest_receipt_info.find(
          (info: any) => info.product_id === productId
        );

        if (latestTransactionForProduct) {
          expiresDate = new Date(parseInt(latestTransactionForProduct.expires_date_ms));
          if (expiresDate.getTime() > Date.now()) {
            isValid = true;
            newStatus = 'active';
          } else {
            newStatus = 'expired';
          }

          logStep("Processing subscription validation", { 
            productId, 
            isValid, 
            expiresDate: expiresDate.toISOString() 
          });

          // Update subscribers table
          const { data: subscriberData, error: subscriberError } = await supabaseClient
            .from('subscribers')
            .upsert({
              user_id: user.id,
              email: user.email,
              apple_subscription_id: latestTransactionForProduct.original_transaction_id,
              subscribed: isValid,
              subscription_tier: isValid ? 'Premium' : null,
              subscription_end: expiresDate.toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'email', ignoreDuplicates: false })
            .select();

          if (subscriberError) {
            logStep('Supabase subscribers update failed', { error: subscriberError });
            return new Response(JSON.stringify({ error: `Subscribers update failed: ${subscriberError.message}` }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Update payments table
          const { data: paymentData, error: paymentError } = await supabaseClient
            .from('payments')
            .upsert({
              tourist_user_id: user.id,
              apple_transaction_id: latestTransactionForProduct.transaction_id,
              apple_original_transaction_id: latestTransactionForProduct.original_transaction_id,
              apple_receipt_data: receiptData,
              amount: 9.99, // Default subscription price
              currency: 'usd',
              platform_fee_amount: 0,
              tour_guide_payout_amount: 9.99,
              status: isValid ? 'succeeded' : 'failed',
              payment_type: 'apple_subscription',
              metadata: {
                product_id: productId,
                expires_date: expiresDate.toISOString(),
                validation_date: new Date().toISOString()
              },
              updated_at: new Date().toISOString(),
            }, { onConflict: 'apple_original_transaction_id', ignoreDuplicates: false })
            .select();

          if (paymentError) {
            logStep('Supabase payments update failed', { error: paymentError });
            return new Response(JSON.stringify({ error: `Payments update failed: ${paymentError.message}` }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          logStep('Subscription status successfully updated in Supabase', { 
            subscriberData, 
            paymentData,
            isValid,
            newStatus 
          });
        } else {
          logStep(`Product ID '${productId}' not found in the latest_receipt_info from Apple's response.`);
        }
      } else {
        logStep('No latest_receipt_info found in Apple response. This might not be an auto-renewable subscription receipt.');
      }

      return new Response(JSON.stringify({ 
        isValid: isValid, 
        subscriptionStatus: newStatus,
        expiresDate: expiresDate?.toISOString() 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      logStep('Apple receipt validation failed', { status: jsonResponse.status, exception: jsonResponse.exception });
      return new Response(JSON.stringify({ 
        isValid: false, 
        error: `Apple validation failed (Status Code: ${jsonResponse.status}).` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error: any) {
    logStep('Unhandled error in verify-apple-receipt Edge Function', { error: error.message });
    return new Response(JSON.stringify({ 
      error: error.message || 'An unexpected server error occurred during receipt validation.' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});