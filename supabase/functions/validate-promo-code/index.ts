import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VALIDATE-PROMO-CODE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Determine environment and get appropriate Stripe key
    const environment = Deno.env.get("STRIPE_ENVIRONMENT") || "test";
    const stripeKey = environment === "live" 
      ? Deno.env.get("STRIPE_PRIVATE_KEY_LIVE")
      : Deno.env.get("STRIPE_PRIVATE_KEY_TEST");
    const priceId = environment === "live"
      ? Deno.env.get("STRIPE_PRICE_ID_LIVE")
      : Deno.env.get("STRIPE_PRICE_ID_TEST");

    if (!stripeKey) throw new Error(`STRIPE_PRIVATE_KEY_${environment.toUpperCase()} is not set`);
    if (!priceId) throw new Error(`STRIPE_PRICE_ID_${environment.toUpperCase()} is not set`);

    logStep("Environment variables verified", { environment });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    logStep("User authenticated", { userId: user.id, email: user.email });

    const { couponCode } = await req.json();

    if (!couponCode) {
      return new Response(JSON.stringify({ error: 'Missing coupon code.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logStep("Validating promotion code", { couponCode });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // 1. Retrieve the promotion code
    const promotionCodes = await stripe.promotionCodes.list({
      code: couponCode,
      active: true,
      limit: 1,
    });

    if (promotionCodes.data.length === 0) {
      logStep("Invalid promotion code", { couponCode });
      return new Response(JSON.stringify({
        valid: false,
        message: 'Invalid or expired promotion code.',
        newAmount: null,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const promotionCode = promotionCodes.data[0];
    const coupon = promotionCode.coupon;

    logStep("Promotion code found", { 
      promotionCodeId: promotionCode.id,
      couponId: coupon.id,
      percentOff: coupon.percent_off,
      amountOff: coupon.amount_off 
    });

    // 2. Retrieve the Price object to get original amount
    const price = await stripe.prices.retrieve(priceId);
    const originalAmount = price.unit_amount; // Amount in cents

    let newAmount = originalAmount;
    let discountMessage = '';

    if (coupon.percent_off) {
      newAmount = originalAmount * (1 - coupon.percent_off / 100);
      discountMessage = `${coupon.percent_off}% off applied!`;
    } else if (coupon.amount_off) {
      newAmount = originalAmount - coupon.amount_off;
      discountMessage = `$${(coupon.amount_off / 100).toFixed(2)} off applied!`;
    }

    // Ensure amount doesn't go below zero
    newAmount = Math.max(0, Math.round(newAmount));

    logStep("Discount calculated", { 
      originalAmount, 
      newAmount, 
      discountMessage 
    });

    return new Response(JSON.stringify({
      valid: true,
      promotionCodeId: promotionCode.id,
      newAmount: newAmount,
      message: discountMessage,
      originalAmount: originalAmount,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in validate-promo-code", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});