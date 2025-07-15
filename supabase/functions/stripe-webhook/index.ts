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
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      logStep("ERROR: No Stripe signature found");
      return new Response("No signature", { status: 400 });
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_PRIVATE_KEY_TEST") || "", {
      apiVersion: "2023-10-16",
    });

    // Verify webhook signature
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK");
    if (!webhookSecret) {
      logStep("ERROR: No webhook secret configured");
      return new Response("Webhook secret not configured", { status: 400 });
    }

    let event;
    try {
      // Use constructEventAsync instead of constructEvent for Deno compatibility
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      logStep("Webhook signature verified", { eventType: event.type });
    } catch (err) {
      logStep("ERROR: Webhook signature verification failed", { error: err.message });
      return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
    }

    // Create Supabase client with service role for secure operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Handle different event types
    switch (event.type) {
      case "payment_intent.succeeded": {
        logStep("Processing payment_intent.succeeded");
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Update payment status in database
        const { data: payment, error: fetchError } = await supabaseClient
          .from("payments")
          .select("*")
          .eq("stripe_payment_intent_id", paymentIntent.id)
          .single();

        if (fetchError || !payment) {
          logStep("ERROR: Payment record not found", { paymentIntentId: paymentIntent.id });
          break;
        }

        // Update payment record (IDs will be captured in charge.succeeded event)
        const { error: updateError } = await supabaseClient
          .from("payments")
          .update({
            status: "succeeded",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        if (updateError) {
          logStep("ERROR: Failed to update payment status", { error: updateError });
        } else {
          logStep("Payment status updated to succeeded", { paymentId: payment.id });
        }

        logStep("Payment processing completed successfully");
        break;
      }

      case "charge.succeeded": {
        logStep("Processing charge.succeeded - Extracting Charge & Transfer IDs");
        const charge = event.data.object as Stripe.Charge;

        // 1. Get the PaymentIntent ID associated with this charge
        const paymentIntentId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;

        // 2. Get the Charge ID
        const stripeChargeId = charge.id;

        // 3. Get the Transfer ID (for Destination Charges)
        let stripeTransferId: string | null = null;
        if (charge.transfer) {
          stripeTransferId = typeof charge.transfer === 'string'
            ? charge.transfer
            : charge.transfer.id;
          logStep("Transfer ID found in charge.transfer field", { transferId: stripeTransferId });
        } else if (charge.transfers?.data?.length > 0) {
          stripeTransferId = charge.transfers.data[0].id;
          logStep("Transfer ID found in charge.transfers.data", { transferId: stripeTransferId });
        }

        logStep("Extracted IDs from charge.succeeded", {
          paymentIntentId: paymentIntentId,
          chargeId: stripeChargeId,
          transferId: stripeTransferId,
        });

        // 4. Update the corresponding payment record in your database
        if (paymentIntentId) {
          const { data: payment, error: fetchError } = await supabaseClient
            .from("payments")
            .select("*")
            .eq("stripe_payment_intent_id", paymentIntentId)
            .single();

          if (fetchError || !payment) {
            logStep("ERROR: Payment record not found for charge.succeeded", { paymentIntentId: paymentIntentId, error: fetchError?.message });
            break;
          }

          // Update payment record with charge and transfer IDs
          const { error: updateError } = await supabaseClient
            .from("payments")
            .update({
              status: "succeeded",
              stripe_charge_id: stripeChargeId,
              stripe_transfer_id: stripeTransferId,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_payment_intent_id", paymentIntentId);

          if (updateError) {
            logStep("ERROR: Failed to update payment with Charge/Transfer IDs", { error: updateError });
          } else {
            logStep("Payment record updated with Charge/Transfer IDs", { paymentId: payment.id });

            // 5. CRITICAL BUSINESS LOGIC FOR FULFILLMENT:
            // Mark the tour as fully booked/purchased
            const { error: tourUpdateError } = await supabaseClient
              .from("generated_tours")
              .update({
                updated_at: new Date().toISOString(),
              })
              .eq("id", payment.tour_id);

            if (tourUpdateError) {
              logStep("ERROR: Failed to update generated_tour status", { error: tourUpdateError });
            } else {
              logStep("Generated tour status updated", { tourId: payment.tour_id });
            }
          }
        } else {
          logStep("WARNING: charge.succeeded received but no associated PaymentIntent ID found", { chargeId: stripeChargeId });
        }
        break;
      }

      case "payment_intent.payment_failed": {
        logStep("Processing payment_intent.payment_failed");
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        const { error: updateError } = await supabaseClient
          .from("payments")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        if (updateError) {
          logStep("ERROR: Failed to update payment status", { error: updateError });
        } else {
          logStep("Payment status updated to failed", { paymentIntentId: paymentIntent.id });
        }
        break;
      }

      case "charge.refunded": {
        logStep("Processing charge.refunded");
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;

        if (paymentIntentId) {
          const { error: updateError } = await supabaseClient
            .from("payments")
            .update({
              status: "refunded",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_payment_intent_id", paymentIntentId);

          if (updateError) {
            logStep("ERROR: Failed to update refund status", { error: updateError });
          } else {
            logStep("Payment status updated to refunded", { chargeId: charge.id });
          }
        }
        logStep("WARNING: Tour guide refund handling not fully implemented");
        break;
      }

      case "charge.dispute.created": {
        logStep("Processing charge.dispute.created");
        const dispute = event.data.object as Stripe.Dispute;
        const paymentIntentId = typeof dispute.payment_intent === 'string'
          ? dispute.payment_intent
          : dispute.payment_intent?.id;

        if (paymentIntentId) {
          const { error: updateError } = await supabaseClient
            .from("payments")
            .update({
              status: "disputed",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_payment_intent_id", paymentIntentId);

          if (updateError) {
            logStep("ERROR: Failed to update dispute status", { error: updateError });
          } else {
            logStep("Payment status updated to disputed", {
              chargeId: dispute.charge,
              disputeId: dispute.id,
            });
          }
        }
        logStep("ALERT: Dispute created - operations team should be notified");
        break;
      }

      default:
        logStep("Unhandled event type", { eventType: event.type });
    }

    // Always return 200 OK to acknowledge receipt of webhook
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logStep("ERROR: Webhook processing failed", { error: error.message });
    console.error("Stripe webhook error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Webhook processing failed" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});