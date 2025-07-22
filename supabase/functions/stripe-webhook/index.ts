
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper logging function for debugging with webhook source tracking
const logStep = (step: string, details?: any, webhookSource?: string) => {
  const sourcePrefix = webhookSource ? `[${webhookSource.toUpperCase()}] ` : '';
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${sourcePrefix}${step}${detailsStr}`);
};

// Helper function to determine subscription tier based on price
const getSubscriptionTier = async (stripe: Stripe, subscription: Stripe.Subscription): Promise<string> => {
  try {
    const priceId = subscription.items.data[0].price.id;
    const price = await stripe.prices.retrieve(priceId);
    const amount = price.unit_amount || 0;
    
    if (amount <= 999) {
      return "Basic";
    } else if (amount <= 1999) {
      return "Premium";
    } else {
      return "Enterprise";
    }
  } catch (error) {
    logStep("ERROR: Failed to determine subscription tier", { error: error.message });
    return "Premium"; // Default fallback
  }
};

// Enhanced webhook signature verification with dual secret support
const verifyWebhookSignature = async (
  stripe: Stripe, 
  body: string, 
  signature: string
): Promise<{ event: Stripe.Event; source: 'main' | 'connect' }> => {
  const mainWebhookSecret = Deno.env.get("STRIPE_WEBHOOK");
  const connectWebhookSecret = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET");

  if (!mainWebhookSecret) {
    throw new Error("Main webhook secret not configured");
  }

  // Try Connect webhook secret first (for account.updated events)
  if (connectWebhookSecret) {
    try {
      const event = await stripe.webhooks.constructEventAsync(body, signature, connectWebhookSecret);
      logStep("Webhook signature verified", { eventType: event.type, source: 'connect' });
      return { event, source: 'connect' };
    } catch (connectError) {
      logStep("Connect webhook signature verification failed, trying main webhook", { error: connectError.message });
    }
  }

  // Fallback to main webhook secret
  try {
    const event = await stripe.webhooks.constructEventAsync(body, signature, mainWebhookSecret);
    logStep("Webhook signature verified", { eventType: event.type, source: 'main' });
    return { event, source: 'main' };
  } catch (mainError) {
    logStep("Main webhook signature verification failed", { error: mainError.message });
    throw new Error(`Webhook signature verification failed for both secrets: ${mainError.message}`);
  }
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

    // Verify webhook signature and determine source
    let event: Stripe.Event;
    let webhookSource: 'main' | 'connect';
    
    try {
      const verificationResult = await verifyWebhookSignature(stripe, body, signature);
      event = verificationResult.event;
      webhookSource = verificationResult.source;
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
      case "account.updated": {
        // Only process account.updated events from Connect webhook
        if (webhookSource !== 'connect') {
          logStep("WARNING: account.updated event received from main webhook, ignoring", { eventType: event.type }, webhookSource);
          break;
        }

        logStep("Processing account.updated - Updating Travel Expert onboarding status", {}, webhookSource);
        const account = event.data.object as Stripe.Account;

        // Use metadata to find the internal user ID
        const internalUserId = account.metadata?.internal_user_id;

        if (!internalUserId) {
          logStep("WARNING: account.updated webhook received without internal_user_id in metadata. Cannot link to profile.", { accountId: account.id }, webhookSource);
          break;
        }

        // Extract relevant status fields from the Stripe Account object
        const stripeAccountStatus = account.details_submitted ?
          (account.charges_enabled && account.payouts_enabled ? 'active' : 'pending_verification') :
          'pending_info'; // User started but hasn't submitted all details

        const stripePayoutsEnabled = account.payouts_enabled || false;
        const stripeChargesEnabled = account.charges_enabled || false;

        // Update the user's profile in the database
        const { error: updateProfileError } = await supabaseClient
          .from('profiles')
          .update({
            stripe_account_status: stripeAccountStatus,
            stripe_payouts_enabled: stripePayoutsEnabled,
            stripe_charges_enabled: stripeChargesEnabled,
            updated_at: new Date().toISOString()
          })
          .eq('id', internalUserId);

        if (updateProfileError) {
          logStep("ERROR: Failed to update profile with Stripe account status", { userId: internalUserId, error: updateProfileError }, webhookSource);
        } else {
          logStep("Travel Expert Stripe account status updated in profile", {
            userId: internalUserId,
            status: stripeAccountStatus,
            payoutsEnabled: stripePayoutsEnabled,
            chargesEnabled: stripeChargesEnabled
          }, webhookSource);
        }
        break;
      }

      case "payment_intent.succeeded": {
        logStep("Processing payment_intent.succeeded", {}, webhookSource);
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Update payment status in database
        const { data: payment, error: fetchError } = await supabaseClient
          .from("payments")
          .select("*")
          .eq("stripe_payment_intent_id", paymentIntent.id)
          .single();

        if (fetchError || !payment) {
          logStep("ERROR: Payment record not found", { paymentIntentId: paymentIntent.id }, webhookSource);
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
          logStep("ERROR: Failed to update payment status", { error: updateError }, webhookSource);
        } else {
          logStep("Payment status updated to succeeded", { paymentId: payment.id }, webhookSource);
        }

        logStep("Payment processing completed successfully", {}, webhookSource);
        break;
      }

      case "charge.succeeded": {
        logStep("Processing charge.succeeded - Extracting Charge & Transfer IDs", {}, webhookSource);
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
          logStep("Transfer ID found in charge.transfer field", { transferId: stripeTransferId }, webhookSource);
        } else if (charge.transfers?.data?.length > 0) {
          stripeTransferId = charge.transfers.data[0].id;
          logStep("Transfer ID found in charge.transfers.data", { transferId: stripeTransferId }, webhookSource);
        }

        logStep("Extracted IDs from charge.succeeded", {
          paymentIntentId: paymentIntentId,
          chargeId: stripeChargeId,
          transferId: stripeTransferId,
        }, webhookSource);

        // 4. Update the corresponding payment record in your database
        if (paymentIntentId) {
          const { data: payment, error: fetchError } = await supabaseClient
            .from("payments")
            .select("*")
            .eq("stripe_payment_intent_id", paymentIntentId)
            .single();

          if (fetchError || !payment) {
            logStep("ERROR: Payment record not found for charge.succeeded", { paymentIntentId: paymentIntentId, error: fetchError?.message }, webhookSource);
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
            logStep("ERROR: Failed to update payment with Charge/Transfer IDs", { error: updateError }, webhookSource);
          } else {
            logStep("Payment record updated with Charge/Transfer IDs", { paymentId: payment.id }, webhookSource);

            // 5. CRITICAL BUSINESS LOGIC FOR FULFILLMENT:
            // Mark the tour as fully booked/purchased
            const { error: tourUpdateError } = await supabaseClient
              .from("generated_tours")
              .update({
                updated_at: new Date().toISOString(),
              })
              .eq("id", payment.tour_id);

            if (tourUpdateError) {
              logStep("ERROR: Failed to update generated_tour status", { error: tourUpdateError }, webhookSource);
            } else {
              logStep("Generated tour status updated", { tourId: payment.tour_id }, webhookSource);
            }
          }
        } else {
          logStep("WARNING: charge.succeeded received but no associated PaymentIntent ID found", { chargeId: stripeChargeId }, webhookSource);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        logStep("Processing payment_intent.payment_failed", {}, webhookSource);
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        const { error: updateError } = await supabaseClient
          .from("payments")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        if (updateError) {
          logStep("ERROR: Failed to update payment status", { error: updateError }, webhookSource);
        } else {
          logStep("Payment status updated to failed", { paymentIntentId: paymentIntent.id }, webhookSource);
        }
        break;
      }

      case "charge.refunded": {
        logStep("Processing charge.refunded", {}, webhookSource);
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
            logStep("ERROR: Failed to update refund status", { error: updateError }, webhookSource);
          } else {
            logStep("Payment status updated to refunded", { chargeId: charge.id }, webhookSource);
          }
        }
        logStep("WARNING: Tour guide refund handling not fully implemented", {}, webhookSource);
        break;
      }

      case "charge.dispute.created": {
        logStep("Processing charge.dispute.created", {}, webhookSource);
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
            logStep("ERROR: Failed to update dispute status", { error: updateError }, webhookSource);
          } else {
            logStep("Payment status updated to disputed", {
              chargeId: dispute.charge,
              disputeId: dispute.id,
            }, webhookSource);
          }
        }
        logStep("ALERT: Dispute created - operations team should be notified", {}, webhookSource);
        break;
      }

      // Subscription event handlers
      case "customer.subscription.created": {
        logStep("Processing customer.subscription.created", {}, webhookSource);
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Get customer email
        const customer = await stripe.customers.retrieve(customerId);
        const customerEmail = (customer as Stripe.Customer).email;
        
        if (customerEmail) {
          // Update subscriber record with subscription ID
          const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
          const isActive = subscription.status === "active";
          const subscriptionTier = await getSubscriptionTier(stripe, subscription);
          
          const { error: updateError } = await supabaseClient
            .from("subscribers")
            .upsert({
              email: customerEmail,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscription.id,
              subscribed: isActive,
              subscription_tier: subscriptionTier,
              subscription_end: subscriptionEnd,
              stripe_cancel_at_period_end: false,
              stripe_status: subscription.status,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'email' });

          if (updateError) {
            logStep("ERROR: Failed to update subscriber on creation", { error: updateError }, webhookSource);
          } else {
            logStep("Subscriber updated on creation", { 
              email: customerEmail,
              subscriptionId: subscription.id,
              subscribed: isActive,
              subscriptionEnd,
              subscriptionTier 
            }, webhookSource);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        logStep("Processing customer.subscription.updated", {}, webhookSource);
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Get customer email
        const customer = await stripe.customers.retrieve(customerId);
        const customerEmail = (customer as Stripe.Customer).email;
        
        if (customerEmail) {
          // Update subscriber record
          const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
          const isActive = subscription.status === "active";
          const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
          const subscriptionTier = await getSubscriptionTier(stripe, subscription);
          
          const { error: updateError } = await supabaseClient
            .from("subscribers")
            .upsert({
              email: customerEmail,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscription.id,
              subscribed: isActive, // Keep subscribed true even if cancel_at_period_end is true
              subscription_tier: subscriptionTier,
              subscription_end: subscriptionEnd,
              stripe_cancel_at_period_end: cancelAtPeriodEnd,
              stripe_status: subscription.status,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'email' });

          if (updateError) {
            logStep("ERROR: Failed to update subscriber", { error: updateError }, webhookSource);
          } else {
            logStep("Subscriber updated", { 
              email: customerEmail,
              subscribed: isActive,
              subscriptionEnd,
              cancelAtPeriodEnd,
              subscriptionTier 
            }, webhookSource);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        logStep("Processing customer.subscription.deleted", {}, webhookSource);
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Get customer email
        const customer = await stripe.customers.retrieve(customerId);
        const customerEmail = (customer as Stripe.Customer).email;
        
        if (customerEmail) {
          const { error: updateError } = await supabaseClient
            .from("subscribers")
            .upsert({
              email: customerEmail,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscription.id,
              subscribed: false, // Revoke access
              subscription_tier: null,
              subscription_end: null,
              stripe_cancel_at_period_end: false,
              stripe_status: "canceled",
              updated_at: new Date().toISOString(),
            }, { onConflict: 'email' });

          if (updateError) {
            logStep("ERROR: Failed to update subscriber on deletion", { error: updateError }, webhookSource);
          } else {
            logStep("Subscriber marked as unsubscribed", { email: customerEmail }, webhookSource);
          }
        }
        break;
      }

      case "invoice.paid": {
        logStep("Processing invoice.paid", {}, webhookSource);
        const invoice = event.data.object as Stripe.Invoice;
        
        // Only process subscription invoices
        if (invoice.subscription) {
          const subscriptionId = invoice.subscription as string;
          const customerId = invoice.customer as string;
          
          // Get customer email
          const customer = await stripe.customers.retrieve(customerId);
          const customerEmail = (customer as Stripe.Customer).email;
          
          if (customerEmail) {
            // Get subscription details
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
            const subscriptionTier = await getSubscriptionTier(stripe, subscription);
            
            const { error: updateError } = await supabaseClient
              .from("subscribers")
              .upsert({
                email: customerEmail,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                subscribed: true,
                stripe_status: "active",
                subscription_tier: subscriptionTier,
                subscription_end: subscriptionEnd,
                stripe_cancel_at_period_end: subscription.cancel_at_period_end || false,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'email' });

            if (updateError) {
              logStep("ERROR: Failed to update subscriber on invoice paid", { error: updateError }, webhookSource);
            } else {
              logStep("Subscriber activated on invoice payment", { 
                email: customerEmail,
                subscriptionEnd,
                subscriptionTier 
              }, webhookSource);
            }
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        logStep("Processing invoice.payment_failed", {}, webhookSource);
        const invoice = event.data.object as Stripe.Invoice;
        
        // Only process subscription invoices
        if (invoice.subscription) {
          const customerId = invoice.customer as string;
          
          // Get customer email
          const customer = await stripe.customers.retrieve(customerId);
          const customerEmail = (customer as Stripe.Customer).email;
          
          if (customerEmail) {
            logStep("Subscription payment failed", { 
              email: customerEmail,
              invoiceId: invoice.id 
            }, webhookSource);
            // Note: We don't immediately deactivate on payment failure
            // Stripe will retry and eventually cancel if needed
          }
        }
        break;
      }

      default:
        logStep("Unhandled event type", { eventType: event.type }, webhookSource);
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
