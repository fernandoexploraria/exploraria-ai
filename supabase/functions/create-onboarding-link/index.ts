import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_PRIVATE_KEY_TEST = Deno.env.get("STRIPE_PRIVATE_KEY_TEST");
    if (!STRIPE_PRIVATE_KEY_TEST) {
      console.error("CRITICAL ERROR: STRIPE_PRIVATE_KEY_TEST is not set.");
      return new Response(
        JSON.stringify({ error: "Server config error: Stripe key missing." }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(STRIPE_PRIVATE_KEY_TEST, { apiVersion: "2023-10-16" });
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId } = await req.json();

    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ error: "Valid userId is required." }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found." }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.role !== 'travel_expert') {
      return new Response(
        JSON.stringify({ error: "User must be a travel expert to connect Stripe account." }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let stripeAccountId: string;

    // Check if user already has a Stripe account ID
    if (profile.stripe_account_id) {
      stripeAccountId = profile.stripe_account_id;
    } else {
      // Create new Stripe Express account
      const newAccount = await stripe.accounts.create({
        type: 'express',
        country: 'US', // Default to US, can be customized based on user location
        email: profile.email,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        business_type: 'individual',
        individual: {
          email: profile.email,
          first_name: profile.full_name?.split(' ')[0] || '',
          last_name: profile.full_name?.split(' ').slice(1).join(' ') || '',
        },
        metadata: {
          internal_user_id: userId,
        },
      });

      stripeAccountId = newAccount.id;

      // Update profile with new Stripe account ID
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({
          stripe_account_id: stripeAccountId,
          stripe_account_status: 'pending_info',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error("Failed to save Stripe account ID:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to link Stripe account internally." }), 
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Generate account link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${req.headers.get('origin') || 'https://lovable.exploraria.ai'}/travel-expert/onboarding/reauth`,
      return_url: `${req.headers.get('origin') || 'https://lovable.exploraria.ai'}/travel-expert/dashboard`,
      type: 'account_onboarding',
    });

    return new Response(
      JSON.stringify({ onboarding_url: accountLink.url }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating onboarding link:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create onboarding link. Please try again.' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});