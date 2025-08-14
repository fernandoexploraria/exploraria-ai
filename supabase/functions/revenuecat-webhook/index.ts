import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Initialize Supabase client with service role key for admin access
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

const REVENUECAT_WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to verify webhook signature
async function verifyWebhookSignature(
  payload: string, 
  signature: string | null, 
  secret: string | undefined
): Promise<boolean> {
  if (!signature || !secret) {
    console.warn('Webhook signature or secret missing. Skipping verification.');
    return false;
  }

  try {
    // Remove 'sha256=' prefix if present
    const cleanSignature = signature.replace('sha256=', '');
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return cleanSignature === expectedSignature;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);
    const signature = req.headers.get('X-RevenueCat-Signature');

    console.log('RevenueCat Webhook received:', {
      event_type: payload.event?.type,
      app_user_id: payload.event?.app_user_id,
      timestamp: new Date().toISOString()
    });

    // DEBUG: Log signature details (without exposing full secret)
    console.log('🔍 Webhook Signature Debug:', {
      hasSignatureHeader: !!signature,
      signatureStart: signature ? signature.substring(0, 20) + '...' : 'none',
      hasWebhookSecret: !!REVENUECAT_WEBHOOK_SECRET,
      secretStart: REVENUECAT_WEBHOOK_SECRET ? REVENUECAT_WEBHOOK_SECRET.substring(0, 10) + '...' : 'none',
      payloadLength: rawBody.length
    });

    // Verify webhook signature for security
    const isValidSignature = await verifyWebhookSignature(rawBody, signature, REVENUECAT_WEBHOOK_SECRET);
    console.log('🔐 Signature verification result:', isValidSignature);
    
    if (!isValidSignature) {
      console.error('❌ Invalid webhook signature - rejecting request');
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const event = payload.event;
    const appUserID = event.app_user_id;

    if (!appUserID) {
      console.warn('RevenueCat webhook received for anonymous user. Skipping database update.');
      return new Response(JSON.stringify({ message: 'Anonymous user, no update needed' }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // --- 1. Update subscribers table (subscription status) ---
    const entitlements = event.subscriber_attributes?.entitlements || {};
    const premiumEntitlement = entitlements.premium; // Your entitlement ID
    const isPremiumActive = premiumEntitlement?.value === 'true' || false;
    
    const subscriptionEndDate = event.expiration_at_ms 
      ? new Date(event.expiration_at_ms).toISOString()
      : null;
    
    const originalPurchaseDate = event.original_app_user_id_alias
      ? new Date(event.original_app_user_id_alias).toISOString()
      : new Date().toISOString();

    console.log('Updating subscriber status:', {
      user_id: appUserID,
      is_subscribed: isPremiumActive,
      subscription_end: subscriptionEndDate
    });

    const { error: subscriberError } = await supabaseAdmin
      .from('subscribers')
      .upsert({
        user_id: appUserID,
        email: event.subscriber_attributes?.email?.value || '',
        subscribed: isPremiumActive,
        subscription_tier: isPremiumActive ? 'premium' : null,
        subscription_end: subscriptionEndDate,
        original_transaction_id: event.original_transaction_id || appUserID,
        latest_transaction_id: event.transaction_id || null,
        billing_issue: event.type === 'BILLING_ISSUE',
        subscription_platform: 'revenuecat',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id', ignoreDuplicates: false });

    if (subscriberError) {
      console.error('Error updating subscribers table:', subscriberError);
      throw new Error(`Failed to update subscriber status: ${subscriberError.message}`);
    }

    console.log(`✅ Subscriber ${appUserID} status updated: ${isPremiumActive ? 'active' : 'inactive'}`);

    // --- 2. Create payments record (individual transaction) ---
    if (event.transaction_id && ['INITIAL_PURCHASE', 'RENEWAL', 'REFUND'].includes(event.type)) {
      const paymentRecord = {
        user_id: appUserID,
        apple_transaction_id: event.transaction_id,
        product_id: event.product_id || 'unknown',
        amount: event.price ? parseFloat(event.price) : 0,
        currency: event.currency || 'USD',
        transaction_date: event.purchased_at_ms 
          ? new Date(event.purchased_at_ms).toISOString()
          : new Date().toISOString(),
        status: event.type === 'REFUND' ? 'REFUNDED' : 'COMPLETED',
        payment_type: 'subscription',
        payment_platform: 'revenuecat',
      };

      console.log('Creating payment record:', {
        transaction_id: paymentRecord.apple_transaction_id,
        type: event.type,
        amount: paymentRecord.amount
      });

      const { error: paymentError } = await supabaseAdmin
        .from('payments')
        .insert(paymentRecord);

      if (paymentError) {
        // Handle duplicate inserts gracefully (webhook retries)
        if (paymentError.code === '23505') { // Unique violation
          console.warn(`Duplicate payment record for transaction ${paymentRecord.apple_transaction_id}. Skipping.`);
        } else {
          console.error('Error inserting payment record:', paymentError);
          throw new Error(`Failed to insert payment record: ${paymentError.message}`);
        }
      } else {
        console.log(`✅ Payment record created for transaction ${paymentRecord.apple_transaction_id}`);
      }
    } else {
      console.log(`ℹ️ No transaction data for event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Webhook processed successfully',
      event_type: event.type,
      user_id: appUserID 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error processing RevenueCat webhook:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});