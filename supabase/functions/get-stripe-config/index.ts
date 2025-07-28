import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const environment = Deno.env.get("STRIPE_ENVIRONMENT") || "test";
    const publicKey = environment === "live" 
      ? Deno.env.get("STRIPE_PUBLIC_KEY_LIVE")
      : Deno.env.get("STRIPE_PUBLIC_KEY_TEST");
    
    console.log(`🔄 Using Stripe ${environment} environment`);
    
    if (!publicKey) {
      return new Response(
        JSON.stringify({ error: `Stripe ${environment} public key not configured` }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    return new Response(
      JSON.stringify({ publicKey, environment }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});