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
  console.log(`[CREATE-EXPERIENCE-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    const { experienceId, price = 999 } = await req.json(); // Default $9.99

    if (!experienceId) {
      throw new Error("Experience ID is required");
    }

    logStep("Processing experience payment", { experienceId, price });

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization required");
    }

    // Create Supabase client with service role for secure operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user from auth token
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("Invalid user authentication");
    }
    
    const tourist = userData.user;
    logStep("Tourist authenticated", { touristId: tourist.id, email: tourist.email });

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

    if (!experience.account_id) {
      throw new Error("Experience tour guide account not configured");
    }

    logStep("Experience details retrieved", { 
      destination: experience.destination, 
      accountId: experience.account_id 
    });

    // Calculate amounts for destination charges
    const totalAmountCents = price; // Already in cents
    const platformCommissionCents = Math.round(totalAmountCents * 0.20); // 20%
    const tourGuideTransferCents = totalAmountCents - platformCommissionCents; // 80%

    logStep("Amount calculations", {
      totalAmountCents,
      platformCommissionCents,
      tourGuideTransferCents
    });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_PRIVATE_KEY_TEST") || "", {
      apiVersion: "2023-10-16",
    });

    // Create or retrieve Stripe customer for tourist
    let stripeCustomerId = null;
    const existingCustomers = await stripe.customers.list({
      email: tourist.email,
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      stripeCustomerId = existingCustomers.data[0].id;
      logStep("Existing Stripe customer found", { customerId: stripeCustomerId });
    } else {
      const newCustomer = await stripe.customers.create({
        email: tourist.email,
        metadata: {
          internal_user_id: tourist.id,
        },
      });
      stripeCustomerId = newCustomer.id;
      logStep("New Stripe customer created", { customerId: stripeCustomerId });
    }

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
        
      logStep("New Stripe product created", { productId });
    }

    // Create Payment Intent with destination charges
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmountCents,
      currency: "usd",
      // Core destination charge configuration
      application_fee_amount: platformCommissionCents,
      transfer_data: {
        destination: experience.account_id, // Tour guide's Stripe account ID
      },
      automatic_payment_methods: {
        enabled: true,
      },
      customer: stripeCustomerId,
      metadata: {
        internal_tour_id: experienceId,
        internal_tour_guide_id: experience.user_id,
        internal_tourist_id: tourist.id,
        stripe_product_id: productId,
        tour_destination: experience.destination,
      },
    });

    logStep("Payment Intent created", { paymentIntentId: paymentIntent.id });

    // Store payment information in database
    const { error: paymentInsertError } = await supabaseClient
      .from("payments")
      .insert({
        stripe_payment_intent_id: paymentIntent.id,
        tour_id: experienceId,
        tour_guide_id: experience.user_id,
        tourist_user_id: tourist.id,
        amount: totalAmountCents / 100, // Convert back to dollars for storage
        currency: "usd",
        platform_fee_amount: platformCommissionCents / 100,
        tour_guide_payout_amount: tourGuideTransferCents / 100,
        status: paymentIntent.status,
        stripe_customer_id: stripeCustomerId,
        metadata: {
          product_id: productId,
          destination: experience.destination,
        },
      });

    if (paymentInsertError) {
      logStep("Error storing payment", { error: paymentInsertError });
      throw new Error("Failed to store payment information");
    }

    logStep("Payment information stored successfully");

    return new Response(JSON.stringify({ 
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logStep("ERROR", { message: error.message });
    console.error("Payment creation error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to create payment session" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});