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
  console.log(`[DAILY-SUBSCRIPTION-CHECK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    logStep("Daily subscription check started");

    const stripeKey = Deno.env.get("STRIPE_PRIVATE_KEY_TEST");
    if (!stripeKey) throw new Error("STRIPE_PRIVATE_KEY_TEST is not set");

    // Use the service role key to perform writes in Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Get all subscribers who are currently marked as subscribed
    const { data: subscribers, error: subscribersError } = await supabaseClient
      .from("subscribers")
      .select("*")
      .eq("subscribed", true);

    if (subscribersError) {
      throw new Error(`Failed to fetch subscribers: ${subscribersError.message}`);
    }

    logStep("Found subscribers to check", { count: subscribers?.length || 0 });

    let updatedCount = 0;
    let errorCount = 0;

    for (const subscriber of subscribers || []) {
      try {
        logStep("Checking subscriber", { email: subscriber.email });

        if (!subscriber.stripe_customer_id) {
          logStep("No Stripe customer ID, marking as unsubscribed", { email: subscriber.email });
          await supabaseClient
            .from("subscribers")
            .update({
              subscribed: false,
              subscription_tier: null,
              subscription_end: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", subscriber.id);
          updatedCount++;
          continue;
        }

        // Check current subscription status in Stripe
        const subscriptions = await stripe.subscriptions.list({
          customer: subscriber.stripe_customer_id,
          status: "active",
          limit: 1,
        });

        const hasActiveSub = subscriptions.data.length > 0;
        let subscriptionTier = null;
        let subscriptionEnd = null;
        let cancelAtPeriodEnd = false;

        if (hasActiveSub) {
          const subscription = subscriptions.data[0];
          subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
          cancelAtPeriodEnd = subscription.cancel_at_period_end;
          
          // Determine subscription tier from price
          const priceId = subscription.items.data[0].price.id;
          const price = await stripe.prices.retrieve(priceId);
          const amount = price.unit_amount || 0;
          if (amount <= 999) {
            subscriptionTier = "Basic";
          } else if (amount <= 1999) {
            subscriptionTier = "Premium";
          } else {
            subscriptionTier = "Enterprise";
          }

          logStep("Subscription still active", { 
            email: subscriber.email, 
            tier: subscriptionTier,
            endDate: subscriptionEnd,
            cancelled: cancelAtPeriodEnd
          });
        } else {
          logStep("Subscription expired, updating to unsubscribed", { email: subscriber.email });
        }

        // Update the subscriber record
        await supabaseClient
          .from("subscribers")
          .update({
            subscribed: hasActiveSub,
            subscription_tier: subscriptionTier,
            subscription_end: subscriptionEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscriber.id);

        updatedCount++;

      } catch (error) {
        logStep("Error checking individual subscriber", { 
          email: subscriber.email, 
          error: error.message 
        });
        errorCount++;
      }
    }

    logStep("Daily subscription check completed", { 
      totalChecked: subscribers?.length || 0,
      updated: updatedCount,
      errors: errorCount
    });

    return new Response(JSON.stringify({
      success: true,
      totalChecked: subscribers?.length || 0,
      updated: updatedCount,
      errors: errorCount
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in daily subscription check", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
