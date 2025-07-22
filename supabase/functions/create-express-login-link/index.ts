
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
  console.log(`[CREATE-EXPRESS-LOGIN-LINK] ${step}${detailsStr}`);
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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Fetch user profile to verify Travel Expert role and Stripe account status
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, stripe_account_id, stripe_account_status, stripe_payouts_enabled')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error(`Failed to fetch user profile: ${profileError?.message}`);
    }

    if (profile.role !== 'travel_expert') {
      throw new Error("User must be a Travel Expert to access Stripe Express dashboard");
    }

    if (profile.stripe_account_status !== 'active') {
      throw new Error("Stripe account must be active to access Express dashboard");
    }

    if (!profile.stripe_account_id) {
      throw new Error("No Stripe account found for this user");
    }

    logStep("Profile verified", { 
      role: profile.role, 
      accountStatus: profile.stripe_account_status,
      accountId: profile.stripe_account_id 
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Create Express login link
    const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id);
    logStep("Express login link created", { accountId: profile.stripe_account_id, url: loginLink.url });

    return new Response(JSON.stringify({ url: loginLink.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-express-login-link", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
