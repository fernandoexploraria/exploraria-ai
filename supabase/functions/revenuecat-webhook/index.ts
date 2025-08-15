import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Initialize Supabase client with the service role key for admin access.
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

// IMPORTANT: This must match the Entitlement ID you configured in RevenueCat.
const PREMIUM_ENTITLEMENT_ID = 'premium_access';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = await req.json();
    // --- WARNING: NO WEBHOOK SIGNATURE VERIFICATION ---
    // As requested, this webhook does NOT implement signature verification.
    // This is INSECURE for production environments.
    // In a production app, you MUST verify the X-RevenueCat-Signature header
    // using the secret from your RevenueCat webhook configuration.

    console.log('[REVENUECAT-WEBHOOK] Received webhook (UNVERIFIED):', JSON.stringify(payload, null, 2));

    const event = payload.event;
    // Use app_user_id as primary identifier (more reliable than original_app_user_id)
    const appUserID = event.app_user_id || event.original_app_user_id;

    if (!appUserID) {
      console.warn('[REVENUECAT-WEBHOOK] Received for anonymous user or missing app_user_id. Skipping database update.');
      return new Response(JSON.stringify({ message: 'Anonymous user, no update needed' }), { status: 200 });
    }

    // Extract event data
    const eventType = event.type;
    const expirationDateMs = event.expiration_at_ms;
    const originalTransactionId = event.original_transaction_id || event.transaction_id;
    
    console.log(`[REVENUECAT-WEBHOOK] Processing event type: ${eventType} for user: ${appUserID}`);

    // --- 1. Update `subscribers` table with comprehensive event handling ---
    let isSubscribed = false;
    let subscriptionEndDate = null;
    let billingIssue = false;

    // Comprehensive event type handling
    switch (eventType) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE': // Product upgrades/downgrades
      case 'TEST':
        isSubscribed = true;
        billingIssue = false; // Clear any previous billing issues
        if (expirationDateMs) {
          subscriptionEndDate = new Date(expirationDateMs).toISOString();
        }
        console.log(`[REVENUECAT-WEBHOOK] ${eventType}: Setting user as subscribed until ${subscriptionEndDate}`);
        break;

      case 'CANCELLATION':
        // User cancelled but may still have access until expiration
        isSubscribed = false;
        if (expirationDateMs) {
          subscriptionEndDate = new Date(expirationDateMs).toISOString();
          // Check if subscription is still active (not expired yet)
          if (new Date(expirationDateMs) > new Date()) {
            isSubscribed = true; // Still active until expiration
            console.log(`[REVENUECAT-WEBHOOK] CANCELLATION: Subscription active until ${subscriptionEndDate}`);
          } else {
            console.log(`[REVENUECAT-WEBHOOK] CANCELLATION: Subscription expired, setting as inactive`);
          }
        }
        break;

      case 'EXPIRATION':
        isSubscribed = false;
        if (expirationDateMs) {
          subscriptionEndDate = new Date(expirationDateMs).toISOString();
        }
        console.log(`[REVENUECAT-WEBHOOK] EXPIRATION: Subscription expired at ${subscriptionEndDate}`);
        break;

      case 'BILLING_ISSUE':
        isSubscribed = false; // Mark as inactive during billing issue
        billingIssue = true;
        console.log(`[REVENUECAT-WEBHOOK] BILLING_ISSUE: Setting billing issue flag and marking as inactive`);
        break;

      case 'UNCANCELLATION': // User reversed a cancellation
        isSubscribed = true;
        billingIssue = false;
        if (expirationDateMs) {
          subscriptionEndDate = new Date(expirationDateMs).toISOString();
        }
        console.log(`[REVENUECAT-WEBHOOK] UNCANCELLATION: Subscription reactivated until ${subscriptionEndDate}`);
        break;

      case 'REFUND':
        isSubscribed = false;
        // Note: Keep existing subscription_end date for record keeping
        console.log(`[REVENUECAT-WEBHOOK] REFUND: Subscription refunded, setting as inactive`);
        break;

      default:
        console.warn(`[REVENUECAT-WEBHOOK] Unhandled event type: ${eventType}. Skipping subscription status update.`);
        // For unhandled events, we'll return early to avoid updating with potentially incorrect data
        return new Response(JSON.stringify({ 
          message: `Event type ${eventType} not handled`, 
          user_id: appUserID 
        }), { status: 200 });
    }

    const { error: subscriberError } = await supabaseAdmin
      .from('subscribers')
      .upsert({
        user_id: appUserID,
        subscribed: isSubscribed,
        subscription_tier: isSubscribed ? PREMIUM_ENTITLEMENT_ID : null,
        subscription_end: subscriptionEndDate,
        original_transaction_id: originalTransactionId,
        latest_transaction_id: event.transaction_id,
        billing_issue: billingIssue,
        subscription_platform: 'revenuecat',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id', ignoreDuplicates: false });

    if (subscriberError) {
      console.error('[REVENUECAT-WEBHOOK] Error updating subscribers table:', subscriberError);
      throw new Error(`Failed to update subscriber status: ${subscriberError.message}`);
    }
    console.log(`[REVENUECAT-WEBHOOK] Subscriber ${appUserID} status updated: subscribed=${isSubscribed}, billing_issue=${billingIssue}`);

    // --- 2. Create `payments` records (individual transactions) ---
    // Only create payment records for actual transaction events
    if (event.transaction_id && event.purchased_at_ms && 
        ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'REFUND'].includes(eventType)) {
      
      // Determine payment status based on event type
      let paymentStatus = 'COMPLETED';
      if (eventType === 'REFUND') {
        paymentStatus = 'REFUNDED';
      }

      const paymentRecord = {
        tourist_user_id: appUserID,
        apple_transaction_id: event.transaction_id,
        product_id: event.product_id,
        amount: event.price || 0,
        currency: event.currency || 'USD',
        transaction_date: new Date(event.purchased_at_ms).toISOString(),
        payment_type: eventType,
        status: paymentStatus,
        payment_platform: 'revenuecat',
      };

      const { error: paymentError } = await supabaseAdmin
        .from('payments')
        .insert(paymentRecord);

      if (paymentError) {
        if (paymentError.code === '23505') {
          console.warn(`[REVENUECAT-WEBHOOK] Duplicate payment record for transaction ID ${paymentRecord.apple_transaction_id}. Skipping insert.`);
        } else {
          console.error('[REVENUECAT-WEBHOOK] Error inserting payment record:', paymentError);
          throw new Error(`Failed to insert payment record: ${paymentError.message}`);
        }
      } else {
        console.log(`[REVENUECAT-WEBHOOK] Payment record inserted for transaction ${paymentRecord.apple_transaction_id} with status ${paymentStatus}`);
      }
    } else {
      console.log(`[REVENUECAT-WEBHOOK] No payment record created for event type: ${eventType}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[REVENUECAT-WEBHOOK] Error processing webhook:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});