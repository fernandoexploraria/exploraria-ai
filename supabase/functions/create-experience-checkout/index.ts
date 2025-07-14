import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-EXPERIENCE-CHECKOUT] ${step}${detailsStr}`);
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

    const stripeKey = Deno.env.get("STRIPE_PRIVATE_KEY_TEST");
    if (!stripeKey) throw new Error("STRIPE_PRIVATE_KEY_TEST is not set");
    logStep("Stripe key verified");

    const { experienceId, price = 999 } = await req.json();
    if (!experienceId) throw new Error("Experience ID is required");
    logStep("Request data", { experienceId, price });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Create Supabase client with service role for database operations
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get origin for URLs
    const origin = req.headers.get("origin") || "https://lovable.exploraria.ai";
    
    // Check if customer already exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    // Check for existing unpaid payment first
    const { data: existingPayment, error: paymentError } = await supabaseService
      .from("payments")
      .select("stripe_payment_intent_id, stripe_customer_id")
      .eq("tour_id", experienceId)
      .eq("tourist_user_id", user.id)
      .eq("status", "requires_payment_method")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existingPayment && !paymentError) {
      logStep("Found existing payment intent", { 
        paymentIntentId: existingPayment.stripe_payment_intent_id 
      });

      // Use existing payment intent to create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: existingPayment.stripe_customer_id,
        payment_intent_data: {
          payment_intent: existingPayment.stripe_payment_intent_id
        },
        mode: "payment",
        success_url: `${origin}/?experience_checkout=success&experience_id=${experienceId}`,
        cancel_url: `${origin}/?experience_checkout=cancelled`,
        metadata: {
          experience_id: experienceId,
          user_id: user.id,
          payment_intent_id: existingPayment.stripe_payment_intent_id
        }
      });

      logStep("Checkout session created with existing payment intent", { 
        sessionId: session.id, 
        url: session.url 
      });

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("No existing payment found, creating new checkout session");
    // Get experience details for new checkout
    const { data: experience, error: experienceError } = await supabaseService
      .from("generated_tours")
      .select("*")
      .eq("id", experienceId)
      .eq("experience", true)
      .single();

    if (experienceError || !experience) {
      throw new Error("Experience not found");
    }

    // Create new checkout session for new payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { 
              name: `Experience: ${experience.destination}`,
              description: experience.description || `Immersive experience in ${experience.destination}`
            },
            unit_amount: price, // $9.99 in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment", // One-time payment for experiences
      success_url: `${origin}/?experience_checkout=success&experience_id=${experienceId}`,
      cancel_url: `${origin}/?experience_checkout=cancelled`,
      metadata: {
        experience_id: experienceId,
        user_id: user.id
      }
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-experience-checkout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});