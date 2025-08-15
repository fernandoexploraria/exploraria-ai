import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-REVENUECAT-SUBSCRIPTION] ${step}${detailsStr}`);
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

    // Use the service role key to perform reads from Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

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
    if (!user?.id) {
      logStep("ERROR: User ID not available");
      return new Response(JSON.stringify({ error: "User ID not available" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    logStep("User authenticated", { userId: user.id });

    // Get RevenueCat subscription data from subscribers table
    const { data: subscriber, error: subscriberError } = await supabaseClient
      .from("subscribers")
      .select("subscribed, subscription_tier, subscription_end, billing_issue, subscription_platform")
      .eq("user_id", user.id)
      .eq("subscription_platform", "revenuecat")
      .single();

    if (subscriberError && subscriberError.code !== "PGRST116") {
      logStep("ERROR: Database query failed", { error: subscriberError.message });
      return new Response(JSON.stringify({ error: "Failed to check subscription" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!subscriber) {
      logStep("No RevenueCat subscription found for user");
      return new Response(JSON.stringify({ 
        subscribed: false,
        subscription_platform: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("RevenueCat subscription found", { 
      subscribed: subscriber.subscribed,
      tier: subscriber.subscription_tier,
      billingIssue: subscriber.billing_issue 
    });

    return new Response(JSON.stringify({
      subscribed: subscriber.subscribed,
      subscription_tier: subscriber.subscription_tier,
      subscription_end: subscriber.subscription_end,
      cancel_at_period_end: false, // RevenueCat handles this differently
      subscription_platform: 'revenuecat',
      billing_issue: subscriber.billing_issue
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-revenuecat-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});