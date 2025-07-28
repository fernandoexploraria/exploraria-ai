import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper logging function for debugging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-SUBSCRIPTION-INTENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== CREATE-SUBSCRIPTION-INTENT STARTED ===");
    logStep("Function started");
    
    // Log all available environment variables for debugging
    const allEnvs = {
      SUPABASE_URL: !!Deno.env.get("SUPABASE_URL"),
      STRIPE_ENVIRONMENT: Deno.env.get("STRIPE_ENVIRONMENT"),
      STRIPE_PRIVATE_KEY_TEST: !!Deno.env.get("STRIPE_PRIVATE_KEY_TEST"),
      STRIPE_PRIVATE_KEY_LIVE: !!Deno.env.get("STRIPE_PRIVATE_KEY_LIVE"),
      STRIPE_PRICE_ID_TEST: !!Deno.env.get("STRIPE_PRICE_ID_TEST"),
      STRIPE_PRICE_ID_LIVE: !!Deno.env.get("STRIPE_PRICE_ID_LIVE"),
    };
    console.log("Environment variables check:", JSON.stringify(allEnvs, null, 2));
    
    // Check all environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const environment = Deno.env.get("STRIPE_ENVIRONMENT") || "test";
    const isLive = environment === "live";
    
    logStep("Environment check", { environment, isLive });
    
    const stripeKey = isLive 
      ? Deno.env.get("STRIPE_PRIVATE_KEY_LIVE")
      : Deno.env.get("STRIPE_PRIVATE_KEY_TEST");
    
    const priceId = isLive 
      ? Deno.env.get("STRIPE_PRICE_ID_LIVE")
      : Deno.env.get("STRIPE_PRICE_ID_TEST");
    
    logStep("Keys check", { 
      hasStripeKey: !!stripeKey, 
      hasPriceId: !!priceId,
      hasSupabaseUrl: !!supabaseUrl 
    });
    
    if (!supabaseUrl) throw new Error("SUPABASE_URL is not set");
    if (!stripeKey) throw new Error(`Stripe private key not set for ${environment} environment`);
    if (!priceId) throw new Error(`Stripe price ID not set for ${environment} environment`);
    
    logStep("Environment variables verified");

    // Create Supabase client with service role for secure operations
    const supabaseClient = createClient(
      supabaseUrl, 
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("Invalid user authentication");
    }
    
    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Find or create Stripe customer
    let customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string;
    
    if (customers.data.length === 0) {
      logStep("Creating new Stripe customer");
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id }
      });
      customerId = customer.id;
      logStep("New customer created", { customerId });
    } else {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    // Define the Oaxaca tour constants as in experience payment
    const oaxacaTourId = "e3abf32b-21e6-4c59-95c7-9ac085881ef0";
    const oaxacaTourGuideId = "169e45ac-7691-402a-a497-d6e83e4fe377";
    const oaxacaProductId = "prod_SgD3DLtGshrg83";

    logStep("Using Oaxaca tour reference for subscription payment", { 
      tourId: oaxacaTourId, 
      guideId: oaxacaTourGuideId 
    });

    // Create subscription with incomplete payment behavior
    let subscription;
    try {
      subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
        metadata: {
          user_id: user.id,
          user_email: user.email,
          reference_tour_id: oaxacaTourId
        },
      });
      logStep("Subscription created", { subscriptionId: subscription.id });
    } catch (stripeError) {
      logStep("Stripe subscription creation failed", { error: stripeError });
      throw new Error(`Failed to create Stripe subscription: ${stripeError instanceof Error ? stripeError.message : String(stripeError)}`);
    }

    // Extract client_secret from the payment intent
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    if (!invoice) {
      throw new Error("No invoice found for subscription");
    }
    
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;
    if (!paymentIntent) {
      throw new Error("No payment intent found for invoice");
    }
    
    const clientSecret = paymentIntent.client_secret;

    if (!clientSecret) {
      throw new Error("Failed to create subscription payment intent");
    }

    logStep("Client secret extracted", { clientSecret: clientSecret.substring(0, 20) + "..." });

    // Validate and determine the payment amount
    let amount;
    if (invoice.amount_total && invoice.amount_total > 0) {
      amount = invoice.amount_total / 100; // Convert cents to dollars
      logStep("Using invoice amount", { invoiceAmount: invoice.amount_total, convertedAmount: amount });
    } else {
      // Fallback to price amount
      const price = await stripe.prices.retrieve(priceId);
      if (price.unit_amount && price.unit_amount > 0) {
        amount = price.unit_amount / 100; // Convert cents to dollars
        logStep("Using price amount as fallback", { priceAmount: price.unit_amount, convertedAmount: amount });
      } else {
        throw new Error("Unable to determine payment amount from invoice or price");
      }
    }

    // Validate final amount
    if (!amount || amount <= 0) {
      throw new Error("Invalid payment amount calculated");
    }

    // Insert payment record using same pattern as experience payment
    const { error: paymentInsertError } = await supabaseClient.from("payments").insert({
      stripe_payment_intent_id: paymentIntent.id,
      tourist_user_id: user.id,
      amount: amount, // Use validated amount
      currency: "usd",
      platform_fee_amount: 0, // No fees for subscriptions
      tour_guide_payout_amount: 0, // No payouts for subscriptions
      status: paymentIntent.status,
      stripe_customer_id: customerId,
      payment_type: "subscription", // NEW: Dedicated field
      stripe_subscription_id: subscription.id, // NEW: Dedicated field
      metadata: {
        price_id: priceId
      }
    });

    if (paymentInsertError) {
      logStep("Error storing payment", { error: paymentInsertError });
      throw new Error("Failed to store payment information");
    }

    logStep("Payment record inserted successfully", { paymentIntentId: paymentIntent.id });

    return new Response(JSON.stringify({ 
      client_secret: clientSecret,
      subscription_id: subscription.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logStep("ERROR", { message: error instanceof Error ? error.message : String(error) });
    console.error("Payment creation error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error) 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});