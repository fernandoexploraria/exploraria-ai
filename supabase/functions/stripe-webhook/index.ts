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
  // Always log webhook requests for debugging
  logStep("Webhook endpoint hit", { 
    method: req.method, 
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Processing webhook request");

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    logStep("Request details", {
      bodyLength: body.length,
      hasSignature: !!signature,
      signatureStart: signature?.substring(0, 20) + "..."
    });

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
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
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
        
        // Log the full payload structure for debugging
        logStep("PaymentIntent received", { 
          id: paymentIntent.id,
          hasCharges: !!paymentIntent.charges,
          chargesCount: paymentIntent.charges?.data?.length || 0,
          latestCharge: paymentIntent.latest_charge
        });
        
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

        // Extract charge and transfer IDs properly
        let stripeChargeId = null;
        let stripeTransferId = null;

        // Try to get the charge ID from latest_charge first, then fallback to charges.data[0]
        if (paymentIntent.latest_charge) {
          stripeChargeId = typeof paymentIntent.latest_charge === 'string' 
            ? paymentIntent.latest_charge 
            : paymentIntent.latest_charge.id;
        } else if (paymentIntent.charges?.data?.length > 0) {
          stripeChargeId = paymentIntent.charges.data[0].id;
        }

        // Get the full charge object to extract transfer information
        let chargeObject = null;
        if (paymentIntent.charges?.data?.length > 0) {
          chargeObject = paymentIntent.charges.data.find(charge => charge.id === stripeChargeId) 
            || paymentIntent.charges.data[0];
        }

        // Extract transfer ID from charge.transfers.data[] (for destination charges)
        if (chargeObject) {
          logStep("Charge object found", {
            chargeId: chargeObject.id,
            hasTransfers: !!chargeObject.transfers,
            transfersCount: chargeObject.transfers?.data?.length || 0,
            singleTransfer: chargeObject.transfer // legacy field
          });

          // Check for transfers in the transfers.data array (for destination charges)
          if (chargeObject.transfers?.data?.length > 0) {
            stripeTransferId = chargeObject.transfers.data[0].id;
            logStep("Transfer ID found in transfers.data", { transferId: stripeTransferId });
          } 
          // Fallback to single transfer field (legacy)
          else if (chargeObject.transfer) {
            stripeTransferId = typeof chargeObject.transfer === 'string' 
              ? chargeObject.transfer 
              : chargeObject.transfer.id;
            logStep("Transfer ID found in transfer field", { transferId: stripeTransferId });
          }
        }

        logStep("Extracted IDs", { 
          chargeId: stripeChargeId, 
          transferId: stripeTransferId 
        });

        // Update payment record
        const { error: updateError } = await supabaseClient
          .from("payments")
          .update({
            status: "succeeded",
            stripe_charge_id: stripeChargeId,
            stripe_transfer_id: stripeTransferId,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        if (updateError) {
          logStep("ERROR: Failed to update payment status", { error: updateError });
        } else {
          logStep("Payment status updated to succeeded", { paymentId: payment.id });
        }

        // Mark the experience as purchased/booked (you may want to add a 'purchased' field to generated_tours)
        const { error: tourUpdateError } = await supabaseClient
          .from("generated_tours")
          .update({ 
            updated_at: new Date().toISOString()
            // Add purchased: true or booking_count: booking_count + 1 if needed
          })
          .eq("id", payment.tour_id);

        if (tourUpdateError) {
          logStep("ERROR: Failed to update tour status", { error: tourUpdateError });
        }

        logStep("Payment processing completed successfully");
        break;
      }

      case "charge.succeeded": {
        logStep("Processing charge.succeeded");
        const charge = event.data.object as Stripe.Charge;
        
        // Get PaymentIntent ID from charge to find the payment record
        const paymentIntentId = typeof charge.payment_intent === 'string' 
          ? charge.payment_intent 
          : charge.payment_intent?.id;
        
        // Extract IDs directly from the charge object
        const stripeChargeId = charge.id;
        const stripeTransferId = charge.transfer?.id || charge.transfers?.data?.[0]?.id;
        
        logStep("Extracted IDs from charge.succeeded", { 
          paymentIntentId, 
          stripeChargeId, 
          stripeTransferId 
        });
        
        // Update only the IDs (don't change status as it's already set by payment_intent.succeeded)
        if (paymentIntentId) {
          const { error } = await supabaseClient
            .from("payments")
            .update({
              stripe_charge_id: stripeChargeId,
              stripe_transfer_id: stripeTransferId,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_payment_intent_id", paymentIntentId);
          
          if (!error) {
            logStep("Charge and Transfer IDs updated", { paymentIntentId, stripeChargeId, stripeTransferId });
          } else {
            logStep("ERROR: Failed to update charge and transfer IDs", { error });
          }
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
        
        const { error: updateError } = await supabaseClient
          .from("payments")
          .update({
            status: "refunded",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_charge_id", charge.id);

        if (updateError) {
          logStep("ERROR: Failed to update refund status", { error: updateError });
        } else {
          logStep("Payment status updated to refunded", { chargeId: charge.id });
        }

        // Note: In a real implementation, you would need to handle the refund 
        // from the tour guide's account. This might involve:
        // 1. Creating a transfer reversal if possible
        // 2. Tracking a negative balance for the guide
        // 3. Deducting from future payouts
        logStep("WARNING: Tour guide refund handling not implemented");
        break;
      }

      case "charge.dispute.created": {
        logStep("Processing charge.dispute.created");
        const dispute = event.data.object as Stripe.Dispute;
        
        const { error: updateError } = await supabaseClient
          .from("payments")
          .update({
            status: "disputed",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_charge_id", dispute.charge);

        if (updateError) {
          logStep("ERROR: Failed to update dispute status", { error: updateError });
        } else {
          logStep("Payment status updated to disputed", { 
            chargeId: dispute.charge,
            disputeId: dispute.id 
          });
        }

        // In a real implementation, you would alert your operations team
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