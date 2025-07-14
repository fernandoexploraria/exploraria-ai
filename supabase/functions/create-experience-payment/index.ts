import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { experienceId, price = 999 } = await req.json(); // Default $9.99

    if (!experienceId) {
      throw new Error("Experience ID is required");
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get experience details
    const { data: experience, error: experienceError } = await supabaseClient
      .from("generated_tours")
      .select("*")
      .eq("id", experienceId)
      .eq("experience", true)
      .single();

    if (experienceError || !experience) {
      throw new Error("Experience not found");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Create or get Stripe product
    let productId = experience.product_id;
    
    if (!productId) {
      // Create a new Stripe product
      const product = await stripe.products.create({
        name: `Experience: ${experience.destination}`,
        description: experience.description || `Immersive experience in ${experience.destination}`,
        metadata: {
          experience_id: experienceId,
        },
      });
      productId = product.id;

      // Update the experience with the product_id
      await supabaseClient
        .from("generated_tours")
        .update({ product_id: productId })
        .eq("id", experienceId);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product: productId,
            unit_amount: price, // Price in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/?payment=success&experience=${experienceId}`,
      cancel_url: `${req.headers.get("origin")}/?payment=cancelled`,
      metadata: {
        experience_id: experienceId,
        product_id: productId,
      },
    });

    return new Response(JSON.stringify({ 
      url: session.url,
      sessionId: session.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Payment creation error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to create payment session" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});