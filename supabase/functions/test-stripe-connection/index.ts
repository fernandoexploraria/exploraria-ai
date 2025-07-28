import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[TEST-STRIPE] Function started");
    
    const stripeKey = Deno.env.get("STRIPE_PRIVATE_KEY_TEST");
    const priceId = Deno.env.get("STRIPE_PRICE_ID");
    
    if (!stripeKey) {
      console.log("[TEST-STRIPE] ERROR: STRIPE_PRIVATE_KEY_TEST is not set");
      throw new Error("STRIPE_PRIVATE_KEY_TEST is not set");
    }
    
    if (!priceId) {
      console.log("[TEST-STRIPE] ERROR: STRIPE_PRICE_ID is not set");
      throw new Error("STRIPE_PRICE_ID is not set");
    }

    console.log("[TEST-STRIPE] Environment variables OK");
    console.log("[TEST-STRIPE] Testing Stripe connection...");

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Test 1: List customers
    const customers = await stripe.customers.list({ limit: 1 });
    console.log("[TEST-STRIPE] Customer list test passed");
    
    // Test 2: Retrieve the price
    const price = await stripe.prices.retrieve(priceId);
    console.log("[TEST-STRIPE] Price retrieval test passed", { 
      priceId, 
      amount: price.unit_amount,
      currency: price.currency 
    });

    return new Response(JSON.stringify({ 
      success: true,
      tests: {
        customerList: "passed",
        priceRetrieval: "passed"
      },
      priceDetails: {
        id: price.id,
        amount: price.unit_amount,
        currency: price.currency,
        active: price.active
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[TEST-STRIPE] ERROR:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error),
      success: false
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});