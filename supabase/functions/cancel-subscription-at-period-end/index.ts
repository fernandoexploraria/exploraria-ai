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
  console.log(`[CANCEL-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_PRIVATE_KEY_TEST");
    if (!stripeKey) {
      throw new Error("STRIPE_PRIVATE_KEY_TEST is not set");
    }
    logStep("Stripe key verified");

    // Initialize Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get auth token and verify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      throw new Error(`Authentication error: ${userError.message}`);
    }
    
    const user = userData.user;
    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Find user's subscription in database
    const { data: subscriber, error: subscriberError } = await supabaseClient
      .from("subscribers")
      .select("*")
      .eq("email", user.email)
      .eq("subscribed", true)
      .single();

    if (subscriberError || !subscriber) {
      throw new Error("No active subscription found for this user");
    }
    logStep("Found active subscription", { subscriptionId: subscriber.stripe_subscription_id });

    // Verify subscription is not already cancelled
    if (subscriber.stripe_cancel_at_period_end) {
      throw new Error("Subscription is already scheduled for cancellation");
    }

    // Initialize Stripe and cancel subscription at period end
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    const updatedSubscription = await stripe.subscriptions.update(
      subscriber.stripe_subscription_id,
      {
        cancel_at_period_end: true,
        metadata: {
          canceled_by_user_id: user.id,
          cancellation_reason: 'user_self_service'
        }
      }
    );
    logStep("Stripe subscription updated", { 
      subscriptionId: updatedSubscription.id, 
      cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end 
    });

    // Note: The webhook will handle updating the database when Stripe sends the
    // customer.subscription.updated event, so we don't need to update it here

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Subscription scheduled for cancellation at period end",
      subscription_end: subscriber.subscription_end
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in cancel-subscription-at-period-end", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});