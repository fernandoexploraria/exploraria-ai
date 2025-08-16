import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Getting payment processor configuration...");
    
    // Get the payment processor from environment
    const paymentProcessor = Deno.env.get('PAYMENT_PROCESSOR') || 'stripe';
    
    console.log("Payment processor configured:", paymentProcessor);
    
    // Validate the processor value
    if (!['stripe', 'apple'].includes(paymentProcessor)) {
      console.warn("Invalid payment processor, defaulting to stripe:", paymentProcessor);
      return new Response(JSON.stringify({ 
        processor: 'stripe',
        error: 'Invalid processor configuration, defaulted to stripe'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ 
      processor: paymentProcessor 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error("Error getting payment processor config:", error);
    
    return new Response(JSON.stringify({ 
      processor: 'stripe', // Default fallback
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});