import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-SUBSCRIPTION-INTENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  console.log("🚀 [CREATE-SUBSCRIPTION-INTENT] Function invoked at:", new Date().toISOString());
  console.log("🚀 [CREATE-SUBSCRIPTION-INTENT] Request method:", req.method);
  
  if (req.method === "OPTIONS") {
    console.log("🚀 [CREATE-SUBSCRIPTION-INTENT] Handling OPTIONS request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started - checking environment");
    
    // Check all environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const stripeKey = Deno.env.get("STRIPE_PRIVATE_KEY_TEST");
    
    logStep("Environment check", { 
      hasSupabaseUrl: !!supabaseUrl, 
      hasSupabaseAnonKey: !!supabaseAnonKey, 
      hasStripeKey: !!stripeKey 
    });
    
    if (!supabaseUrl) throw new Error("SUPABASE_URL is not set");
    if (!supabaseAnonKey) throw new Error("SUPABASE_ANON_KEY is not set");
    if (!stripeKey) throw new Error("STRIPE_PRIVATE_KEY_TEST is not set");
    
    logStep("All environment variables verified");

    // Create Supabase client for authentication
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Attempting to get user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
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

    // Get the price ID from secrets
    const priceId = Deno.env.get("STRIPE_PRICE_ID");
    if (!priceId) throw new Error("STRIPE_PRICE_ID is not set");
    logStep("Price ID retrieved", { priceId: priceId.substring(0, 10) + "..." });

    // Create subscription with incomplete payment behavior
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: priceId,
        },
      ],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        user_id: user.id,
        user_email: user.email,
      },
    });

    logStep("Subscription created", { subscriptionId: subscription.id });

    // Extract client_secret from the payment intent
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;
    const clientSecret = paymentIntent.client_secret;

    if (!clientSecret) {
      throw new Error("Failed to create subscription payment intent");
    }

    logStep("Client secret extracted", { clientSecret: clientSecret.substring(0, 20) + "..." });

    // Insert PaymentIntent record into payments table immediately
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get the price to determine amount since invoice.amount_total might be null
    const price = await stripe.prices.retrieve(priceId);
    const amount = price.unit_amount || 999; // Fallback to $9.99 if no amount found
    
    const { error: insertError } = await supabaseService.from("payments").insert({
      stripe_payment_intent_id: paymentIntent.id,
      stripe_customer_id: customerId,
      amount: amount / 100, // Convert from cents to dollars
      currency: "usd",
      status: "requires_payment_method",
      tour_guide_id: "subscription", // Placeholder for subscription payments
      tour_id: "00000000-0000-0000-0000-000000000000", // Placeholder UUID for subscription
      platform_fee_amount: 0, // No platform fee for subscriptions
      tour_guide_payout_amount: 0, // No payout for subscriptions
      tourist_user_id: user.id,
      metadata: {
        subscription_id: subscription.id,
        price_id: priceId,
        customer_id: customerId,
        payment_type: "subscription"
      }
    });

    if (insertError) {
      logStep("Error inserting payment record", { error: insertError });
      // Don't fail the entire flow for this, just log the error
    } else {
      logStep("Payment record inserted successfully", { paymentIntentId: paymentIntent.id });
    }

    return new Response(JSON.stringify({ 
      client_secret: clientSecret,
      subscription_id: subscription.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-subscription-intent", { message: errorMessage });
    
    // Also log to console for debugging when BigQuery logs are unavailable
    console.error("DETAILED ERROR:", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});