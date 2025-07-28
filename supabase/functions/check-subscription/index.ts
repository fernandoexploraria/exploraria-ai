
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
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
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
    if (!stripeKey) {
      logStep("ERROR: STRIPE_PRIVATE_KEY_TEST is not set");
      return new Response(JSON.stringify({ error: "Stripe configuration missing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
    logStep("Stripe key verified");

    // Use the service role key to perform writes (upsert) in Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Enhanced authentication error handling with specific status codes
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No authorization header provided");
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      logStep("ERROR: Authentication failed", { error: userError?.message });
      return new Response(JSON.stringify({ error: "Invalid authentication token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    
    const user = userData.user;
    if (!user?.email) {
      logStep("ERROR: User email not available");
      return new Response(JSON.stringify({ error: "User email not available" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Initialize variables with clear defaults
    let stripeCustomerId: string | null = null;
    let isActive = false;
    let subscriptionTier: string | null = null;
    let subscriptionEnd: string | null = null;
    let cancelAtPeriodEnd = false;
    let stripeStatus: string | null = null;

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Enhanced Stripe customer lookup with error handling
    let customers;
    try {
      customers = await stripe.customers.list({ email: user.email, limit: 1 });
      logStep("Stripe customer lookup successful");
    } catch (stripeError: any) {
      logStep("ERROR: Stripe customer lookup failed", { 
        error: stripeError.message, 
        type: stripeError.type,
        code: stripeError.code 
      });
      stripeStatus = "error_fetching";
      
      // Try to preserve existing subscriber data when Stripe is unavailable
      try {
        const { data: existingSubscriber } = await supabaseClient
          .from("subscribers")
          .select("stripe_customer_id, subscribed, subscription_tier, subscription_end, stripe_status, stripe_cancel_at_period_end")
          .eq("email", user.email)
          .single();
        
        if (existingSubscriber) {
          logStep("Preserving existing subscriber data due to Stripe API failure", existingSubscriber);
          await supabaseClient.from("subscribers").upsert({
            email: user.email,
            user_id: user.id,
            stripe_customer_id: existingSubscriber.stripe_customer_id,
            subscribed: existingSubscriber.subscribed,
            subscription_tier: existingSubscriber.subscription_tier,
            subscription_end: existingSubscriber.subscription_end,
            stripe_status: "error_fetching",
            stripe_cancel_at_period_end: existingSubscriber.stripe_cancel_at_period_end,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'email' });
          
          return new Response(JSON.stringify({
            subscribed: existingSubscriber.subscribed,
            subscription_tier: existingSubscriber.subscription_tier,
            subscription_end: existingSubscriber.subscription_end,
            cancel_at_period_end: existingSubscriber.stripe_cancel_at_period_end,
            error: "Stripe temporarily unavailable, showing cached data"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      } catch (dbError: any) {
        logStep("ERROR: Database fallback also failed", { error: dbError.message });
      }
      
      // Final fallback - return unsubscribed state with error status
      await supabaseClient.from("subscribers").upsert({
        email: user.email,
        user_id: user.id,
        stripe_customer_id: null,
        subscribed: false,
        subscription_tier: null,
        subscription_end: null,
        stripe_status: "error_fetching",
        stripe_cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });
      
      return new Response(JSON.stringify({ 
        subscribed: false,
        error: "Unable to verify subscription status" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    if (customers.data.length === 0) {
      logStep("No customer found, updating unsubscribed state");
      await supabaseClient.from("subscribers").upsert({
        email: user.email,
        user_id: user.id,
        stripe_customer_id: null,
        subscribed: false,
        subscription_tier: null,
        subscription_end: null,
        stripe_status: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    stripeCustomerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId: stripeCustomerId });

    // Get existing subscriber record to check for canceled status
    let existingSubscriber;
    try {
      const { data } = await supabaseClient
        .from("subscribers")
        .select("stripe_status, subscription_end")
        .eq("email", user.email)
        .single();
      existingSubscriber = data;
    } catch (dbError: any) {
      logStep("Could not fetch existing subscriber record", { error: dbError.message });
    }

    // Enhanced subscription lookup with error handling
    let subscriptions;
    try {
      subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        limit: 1,
      });
      logStep("Stripe subscription lookup successful");
    } catch (stripeError: any) {
      logStep("ERROR: Stripe subscription lookup failed", { 
        error: stripeError.message, 
        type: stripeError.type,
        code: stripeError.code 
      });
      stripeStatus = "error_fetching";
      
      // Preserve existing canceled status if available
      if (existingSubscriber?.stripe_status === 'canceled') {
        stripeStatus = 'canceled';
        subscriptionEnd = existingSubscriber.subscription_end;
        logStep("Preserving canceled status from existing record due to API failure");
      }
      
      await supabaseClient.from("subscribers").upsert({
        email: user.email,
        user_id: user.id,
        stripe_customer_id: stripeCustomerId,
        subscribed: false,
        subscription_tier: null,
        subscription_end: subscriptionEnd,
        stripe_status: stripeStatus,
        stripe_cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });

      return new Response(JSON.stringify({
        subscribed: false,
        subscription_tier: null,
        subscription_end: subscriptionEnd,
        cancel_at_period_end: false,
        error: "Unable to verify current subscription status"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      stripeStatus = subscription.status;
      isActive = subscription.status === "active";
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
      
      logStep("Subscription found", { 
        subscriptionId: subscription.id, 
        status: subscription.status,
        endDate: subscriptionEnd,
        cancelAtPeriodEnd 
      });
      
      // Only determine tier for active subscriptions with enhanced price lookup error handling
      if (isActive) {
        const priceId = subscription.items.data[0].price.id;
        try {
          const price = await stripe.prices.retrieve(priceId);
          const amount = price.unit_amount || 0;
          if (amount <= 999) {
            subscriptionTier = "Basic";
          } else if (amount <= 1999) {
            subscriptionTier = "Premium";
          } else {
            subscriptionTier = "Enterprise";
          }
          logStep("Determined subscription tier", { priceId, amount, subscriptionTier });
        } catch (stripeError: any) {
          logStep("ERROR: Stripe price lookup failed", { 
            error: stripeError.message, 
            type: stripeError.type,
            priceId 
          });
          subscriptionTier = "Basic"; // Default fallback tier
          logStep("Using fallback subscription tier", { subscriptionTier });
        }
      }
    } else {
      logStep("No subscription found - checking for existing canceled status");
      // If no subscription found but existing record has canceled status, preserve it
      if (existingSubscriber?.stripe_status === 'canceled') {
        stripeStatus = 'canceled';
        subscriptionEnd = existingSubscriber.subscription_end;
        logStep("Preserving canceled status from webhook", { stripeStatus, subscriptionEnd });
      }
    }

    await supabaseClient.from("subscribers").upsert({
      email: user.email,
      user_id: user.id,
      stripe_customer_id: stripeCustomerId,
      subscribed: isActive,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd,
      stripe_status: stripeStatus,
      stripe_cancel_at_period_end: cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' });

    logStep("Updated database with subscription info", { subscribed: isActive, subscriptionTier, stripeStatus, cancelAtPeriodEnd });
    return new Response(JSON.stringify({
      subscribed: isActive,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd,
      cancel_at_period_end: cancelAtPeriodEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
