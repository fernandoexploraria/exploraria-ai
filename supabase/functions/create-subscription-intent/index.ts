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
    
    // Basic environment check first
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const environment = Deno.env.get("STRIPE_ENVIRONMENT") || "test";
    const isLive = environment === "live";
    
    console.log("Environment:", environment, "isLive:", isLive);
    
    const stripeKey = isLive 
      ? Deno.env.get("STRIPE_PRIVATE_KEY_LIVE")
      : Deno.env.get("STRIPE_PRIVATE_KEY_TEST");
    
    const priceId = isLive 
      ? Deno.env.get("STRIPE_PRICE_ID_LIVE")
      : Deno.env.get("STRIPE_PRICE_ID_TEST");
    
    console.log("Keys available:", {
      supabaseUrl: !!supabaseUrl,
      stripeKey: !!stripeKey,
      priceId: !!priceId
    });
    
    // Return early for testing
    return new Response(JSON.stringify({ 
      status: "testing",
      environment,
      hasKeys: {
        supabaseUrl: !!supabaseUrl,
        stripeKey: !!stripeKey,
        priceId: !!priceId
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in create-subscription-intent:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error) 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});