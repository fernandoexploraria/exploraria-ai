
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
  console.log(`[CREATE-ONBOARDING-LINK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Processing onboarding link request");

    // Get authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      logStep("ERROR: No authorization header");
      return new Response(
        JSON.stringify({ error: "Authentication required" }), 
        { 
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user from JWT
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      logStep("ERROR: Invalid authentication token", { error: authError?.message });
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }), 
        { 
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      logStep("ERROR: User profile not found", { userId: user.id, error: profileError?.message });
      return new Response(
        JSON.stringify({ error: "User profile not found" }), 
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Verify user is a travel expert
    if (profile.role !== 'travel_expert') {
      logStep("ERROR: User is not a travel expert", { userId: user.id, role: profile.role });
      return new Response(
        JSON.stringify({ error: "Only travel experts can create Stripe accounts" }), 
        { 
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Initialize Stripe
    const STRIPE_PRIVATE_KEY_TEST = Deno.env.get("STRIPE_PRIVATE_KEY_TEST");
    if (!STRIPE_PRIVATE_KEY_TEST) {
      logStep("ERROR: STRIPE_PRIVATE_KEY_TEST not configured");
      return new Response(
        JSON.stringify({ error: "Stripe configuration missing" }), 
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const stripe = new Stripe(STRIPE_PRIVATE_KEY_TEST, {
      apiVersion: "2023-10-16",
    });

    let stripeAccountId: string;

    // Check if user already has a Stripe account
    if (profile.stripe_account_id) {
      stripeAccountId = profile.stripe_account_id;
      logStep("Using existing Stripe account", { accountId: stripeAccountId });
      
      // Verify the account still exists
      try {
        await stripe.accounts.retrieve(stripeAccountId);
      } catch (error) {
        logStep("ERROR: Existing Stripe account not found, creating new one", { accountId: stripeAccountId });
        stripeAccountId = ""; // Will create new account below
      }
    }

    // Create new Stripe Express account if needed
    if (!stripeAccountId) {
      logStep("Creating new Stripe Express account");
      
      const newAccount = await stripe.accounts.create({
        type: 'express',
        country: 'US', // Default to US, easily configurable
        email: profile.email,
        capabilities: {
          transfers: { requested: true }, // Essential for receiving payouts
          card_payments: { requested: true }, // Useful for marketplace functionality
        },
        business_type: 'individual', // Most Travel Experts will be individuals
        individual: {
          email: profile.email,
          first_name: profile.full_name?.split(' ')[0] || '',
          last_name: profile.full_name?.split(' ').slice(1).join(' ') || '',
        },
        metadata: {
          internal_user_id: user.id, // Link back to our internal user ID
        },
      });

      stripeAccountId = newAccount.id;
      logStep("Created new Stripe account", { accountId: stripeAccountId });

      // Store the new Stripe account ID in the profile
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({
          stripe_account_id: stripeAccountId,
          stripe_account_status: 'pending_info',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        logStep("ERROR: Failed to save Stripe account ID", { error: updateError });
        return new Response(
          JSON.stringify({ error: "Failed to save Stripe account information" }), 
          { 
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    }

    // Generate account onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${req.url.split('/functions')[0]}/curator-portal?stripe_refresh=true`, // Back to curator portal with refresh flag
      return_url: `${req.url.split('/functions')[0]}/curator-portal?stripe_success=true`, // Back to curator portal with success flag
      type: 'account_onboarding',
    });

    logStep("Generated onboarding link", { accountId: stripeAccountId });

    return new Response(
      JSON.stringify({ 
        url: accountLink.url,
        account_id: stripeAccountId 
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    logStep("ERROR: Unexpected error", { error: error.message });
    console.error("Create onboarding link error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Failed to create onboarding link" 
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
