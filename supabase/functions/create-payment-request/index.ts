import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PAYMENT-REQUEST] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_PRIVATE_KEY_TEST");
    if (!stripeKey) throw new Error("STRIPE_PRIVATE_KEY_TEST is not set");
    logStep("Stripe key verified");

    // Initialize Supabase client with service role key for full access
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Parse request body
    const { tourId, touristId } = await req.json();
    logStep("Request body parsed", { tourId, touristId });

    // Input validation
    if (!tourId || !touristId) {
      return new Response(
        JSON.stringify({ error: "tourId and touristId are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Retrieve tour & guide data
    const { data: tourData, error: tourError } = await supabaseClient
      .from("generated_tours")
      .select("*")
      .eq("id", tourId)
      .single();

    if (tourError || !tourData) {
      logStep("Tour not found", { tourId, tourError });
      return new Response(
        JSON.stringify({ error: "Tour not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    logStep("Tour data retrieved", { destination: tourData.destination, userId: tourData.user_id });

    // For now, use fixed pricing - later this should come from the tour data
    const tourPrice = 10.00; // $10 USD fixed price
    const currency = "usd";

    // Calculate amounts in cents
    const totalAmountCents = Math.round(tourPrice * 100);
    const platformCommissionCents = Math.round(totalAmountCents * 0.20);
    const tourGuideTransferCents = totalAmountCents - platformCommissionCents;

    logStep("Amounts calculated", {
      totalAmountCents,
      platformCommissionCents,
      tourGuideTransferCents
    });

    // Initialize Stripe client
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Create or retrieve Stripe customer
    const { data: existingCustomer } = await supabaseClient
      .from("subscribers")
      .select("stripe_customer_id")
      .eq("user_id", touristId)
      .single();

    let stripeCustomerId = existingCustomer?.stripe_customer_id;

    if (!stripeCustomerId) {
      // Get user email for customer creation
      const { data: userData } = await supabaseClient.auth.admin.getUserById(touristId);
      const userEmail = userData?.user?.email;

      if (!userEmail) {
        return new Response(
          JSON.stringify({ error: "User email not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { internal_user_id: touristId }
      });

      stripeCustomerId = customer.id;
      logStep("New Stripe customer created", { stripeCustomerId });

      // Store customer ID in database
      await supabaseClient
        .from("subscribers")
        .upsert({
          user_id: touristId,
          email: userEmail,
          stripe_customer_id: stripeCustomerId
        }, { onConflict: 'user_id' });
    }

    // For now, we'll create a simple payment intent without destination charges
    // Later, when we have connected accounts, we can add transfer_data
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmountCents,
      currency: currency,
      customer: stripeCustomerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        internal_tour_id: tourId,
        internal_tour_guide_id: tourData.user_id,
        internal_tourist_id: touristId,
      },
      description: `Payment for tour: ${tourData.destination}`,
    });

    logStep("Payment Intent created", { paymentIntentId: paymentIntent.id });

    // Persist payment information to database
    const { data: paymentData, error: paymentError } = await supabaseClient
      .from("payments")
      .insert({
        stripe_payment_intent_id: paymentIntent.id,
        tour_id: tourId,
        tour_guide_id: tourData.user_id,
        tourist_user_id: touristId,
        amount: tourPrice,
        currency: currency,
        platform_fee_amount: platformCommissionCents / 100,
        tour_guide_payout_amount: tourGuideTransferCents / 100,
        status: paymentIntent.status,
      })
      .select()
      .single();

    if (paymentError) {
      logStep("Payment insertion failed", { paymentError });
      return new Response(
        JSON.stringify({ error: "Failed to create payment record" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    logStep("Payment record created", { paymentId: paymentData.id });

    // Return client_secret for frontend
    return new Response(
      JSON.stringify({ 
        client_secret: paymentIntent.client_secret,
        payment_id: paymentData.id 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-payment-request", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});