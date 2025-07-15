import Stripe from "stripe";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper logging function for debugging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    return res.status(200).json({});
  }

  try {
    logStep("Webhook received");

    const body = req.body;
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      logStep("ERROR: No Stripe signature found");
      return res.status(400).json({ error: "No signature" });
    }

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY_TEST || "", {
      apiVersion: "2023-10-16",
    });

    // Verify webhook signature
    const webhookSecret = process.env.STRIPE_WEBHOOK;
    if (!webhookSecret) {
      logStep("ERROR: No webhook secret configured");
      return res.status(400).json({ error: "Webhook secret not configured" });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Webhook signature verified", { eventType: event.type });
    } catch (err: any) {
      logStep("ERROR: Webhook signature verification failed", { error: err.message });
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    // Create Supabase client with service role for secure operations
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseClient = createClient(
      process.env.SUPABASE_URL ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      { auth: { persistSession: false } }
    );

    // Handle different event types
    switch (event.type) {
      case "payment_intent.succeeded": {
        logStep("Processing payment_intent.succeeded");
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Quick status update - charge and transfer IDs will be handled by charge.succeeded
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
          logStep("PaymentIntent status updated to succeeded", { paymentIntentId: paymentIntent.id });
        }
        break;
      }

      case "charge.succeeded": {
        logStep("Processing charge.succeeded");
        const charge = event.data.object as Stripe.Charge;

        // Extract PaymentIntent ID from the charge
        const paymentIntentId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;

        // Extract Charge ID (this is the event's object ID)
        const stripeChargeId = charge.id;

        // Extract Transfer ID for Destination Charges
        let stripeTransferId = null;
        if (charge.transfer) {
          // 'transfer' field is typically populated for single transfers
          stripeTransferId = typeof charge.transfer === 'string'
            ? charge.transfer
            : charge.transfer.id;
          logStep("Transfer ID found in charge.transfer field", { transferId: stripeTransferId });
        } else if (charge.transfers?.data?.length > 0) {
          // Fallback to 'transfers.data' array if 'transfer' is not directly populated
          stripeTransferId = charge.transfers.data[0].id;
          logStep("Transfer ID found in charge.transfers.data", { transferId: stripeTransferId });
        }

        logStep("Extracted IDs from charge.succeeded", {
          paymentIntentId: paymentIntentId,
          chargeId: stripeChargeId,
          transferId: stripeTransferId,
        });

        if (paymentIntentId) {
          // Update the payment record with the charge and transfer IDs
          const { error: updateError } = await supabaseClient
            .from("payments")
            .update({
              status: "succeeded", // Ensure status is succeeded (redundant but safe)
              stripe_charge_id: stripeChargeId,
              stripe_transfer_id: stripeTransferId,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_payment_intent_id", paymentIntentId);

          if (updateError) {
            logStep("ERROR: Failed to update payment with charge/transfer IDs", { error: updateError });
          } else {
            logStep("Payment record updated with Charge and Transfer IDs", { paymentIntentId });
            
            // This is the ideal place for full order fulfillment
            // Get the payment record to access tour_id for marking as booked
            const { data: payment, error: fetchError } = await supabaseClient
              .from("payments")
              .select("tour_id")
              .eq("stripe_payment_intent_id", paymentIntentId)
              .single();

            if (payment && !fetchError) {
              // Mark the experience as purchased/booked
              const { error: tourUpdateError } = await supabaseClient
                .from("generated_tours")
                .update({ 
                  updated_at: new Date().toISOString()
                  // Add purchased: true or booking_count: booking_count + 1 if needed
                })
                .eq("id", payment.tour_id);

              if (tourUpdateError) {
                logStep("ERROR: Failed to update tour status", { error: tourUpdateError });
              } else {
                logStep("Tour booking completed successfully", { tourId: payment.tour_id });
              }
            }
          }
        } else {
          logStep("WARNING: Charge succeeded but no associated PaymentIntent ID found", { chargeId: stripeChargeId });
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
    return res.status(200).json({ received: true });

  } catch (error: any) {
    logStep("ERROR: Webhook processing failed", { error: error.message });
    console.error("Stripe webhook error:", error);
    return res.status(500).json({ 
      error: error.message || "Webhook processing failed" 
    });
  }
}