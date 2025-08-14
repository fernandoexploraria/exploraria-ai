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
    const subscriberInfo = event.purchaser_info;
    const appUserID = subscriberInfo.original_app_user_id;

    if (!appUserID) {
      console.warn('[REVENUECAT-WEBHOOK] Received for anonymous user or missing app_user_id. Skipping database update.');
      return new Response(JSON.stringify({ message: 'Anonymous user, no update needed' }), { status: 200 });
    }

    // --- 1. Update `subscribers` table (current subscription status) ---
    const premiumEntitlement = subscriberInfo.entitlements[PREMIUM_ENTITLEMENT_ID];
    const isPremiumActive = premiumEntitlement?.active || false;
    const subscriptionTier = isPremiumActive ? PREMIUM_ENTITLEMENT_ID : null;
    const subscriptionEndDate = premiumEntitlement?.expires_date ? new Date(premiumEntitlement.expires_date).toISOString() : null;
    const originalPurchaseDate = subscriberInfo.original_purchase_date ? new Date(subscriberInfo.original_purchase_date).toISOString() : null;
    const originalTransactionId = subscriberInfo.original_app_user_id;

    const { error: subscriberError } = await supabaseAdmin
      .from('subscribers')
      .upsert({
        user_id: appUserID,
        subscribed: isPremiumActive,
        subscription_tier: subscriptionTier,
        subscription_end: subscriptionEndDate,
        original_transaction_id: originalTransactionId,
        latest_transaction_id: subscriberInfo.latest_purchase_receipt || null,
        billing_issue: subscriberInfo.first_seen_date === subscriberInfo.last_seen_date && !isPremiumActive,
        subscription_platform: 'revenuecat',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id', ignoreDuplicates: false });

    if (subscriberError) {
      console.error('[REVENUECAT-WEBHOOK] Error updating subscribers table:', subscriberError);
      throw new Error(`Failed to update subscriber status: ${subscriberError.message}`);
    }
    console.log(`[REVENUECAT-WEBHOOK] Subscriber ${appUserID} status updated: ${isPremiumActive ? 'active' : 'inactive'}`);

    // --- 2. Create `payments` records (individual transactions) ---
    const transaction = event.transaction;

    if (transaction) {
      const paymentRecord = {
        tourist_user_id: appUserID,
        apple_transaction_id: transaction.id,
        product_id: transaction.product_id,
        amount: transaction.price,
        currency: transaction.currency,
        transaction_date: new Date(transaction.purchased_at_ms).toISOString(),
        payment_type: event.type,
        status: transaction.type === 'REFUND' ? 'REFUNDED' : 'COMPLETED',
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
        console.log(`[REVENUECAT-WEBHOOK] Payment record inserted for transaction ${paymentRecord.apple_transaction_id}`);
      }
    } else {
      console.log('[REVENUECAT-WEBHOOK] No transaction data in webhook event. Skipping payment record creation.');
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