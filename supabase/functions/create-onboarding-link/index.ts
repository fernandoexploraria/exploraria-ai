
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
  console.log(`[CREATE-ONBOARDING-LINK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    logStep("Processing onboarding link request");

    // Parse request body to get business_type parameter
    const { business_type } = await req.json();
    if (!business_type || !['individual', 'company'].includes(business_type)) {
      throw new Error("Valid business_type parameter (individual or company) is required");
    }
    logStep("Business type selected", { business_type });

    const stripeKey = Deno.env.get("STRIPE_PRIVATE_KEY_TEST");
    if (!stripeKey) throw new Error("STRIPE_PRIVATE_KEY_TEST is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    logStep("User authenticated", { userId: user.id, email: user.email });

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error(`Failed to fetch user profile: ${profileError?.message}`);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    let stripeAccountId: string;

    if (profile.stripe_account_id) {
      stripeAccountId = profile.stripe_account_id;
      logStep("Using existing Stripe account", { accountId: stripeAccountId });
    } else {
      logStep("Creating new Stripe Express account");
      
      const accountData: any = {
        type: 'express',
        country: 'US',
        email: profile.email,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        business_type: business_type,
        metadata: {
          internal_user_id: user.id,
        },
      };

      // Only add individual data if business_type is 'individual'
      if (business_type === 'individual') {
        accountData.individual = {
          email: profile.email,
          first_name: profile.full_name?.split(' ')[0] || '',
          last_name: profile.full_name?.split(' ').slice(1).join(' ') || '',
        };
      }

      const newAccount = await stripe.accounts.create(accountData);
      
      stripeAccountId = newAccount.id;
      logStep("Created new Stripe account", { accountId: stripeAccountId });

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
        throw new Error("Failed to link Stripe account");
      }
    }

    // Get the origin from the request
    const origin = req.headers.get("origin") || "https://lovable.exploraria.ai";
    
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/curator-portal?stripe_refresh=true`,
      return_url: `${origin}/curator-portal?stripe_success=true`,
      type: 'account_onboarding',
    });

    logStep("Generated onboarding link", { accountId: stripeAccountId });

    return new Response(JSON.stringify({ url: accountLink.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-onboarding-link", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
