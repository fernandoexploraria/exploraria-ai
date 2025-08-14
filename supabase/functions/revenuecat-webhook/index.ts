import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  console.log('🎯 RevenueCat webhook called with method:', req.method)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🎯 Handling OPTIONS preflight request')
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🎯 Processing RevenueCat webhook request')
    
    const body = await req.json()
    console.log('🎯 Webhook payload:', JSON.stringify(body, null, 2))

    const { event } = body

    if (!event) {
      console.log('🎯 No event found in payload')
      return new Response(
        JSON.stringify({ error: 'No event found' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const eventType = event.type
    const appUserId = event.app_user_id
    const productId = event.product_id
    const originalTransactionId = event.original_transaction_id
    const transactionId = event.transaction_id
    const store = event.store
    const purchasedAt = event.purchased_at_ms ? new Date(event.purchased_at_ms) : new Date()
    const expirationAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null

    console.log('🎯 Processing event:', {
      eventType,
      appUserId,
      productId,
      originalTransactionId,
      transactionId,
      store
    })

    // Handle different event types
    switch (eventType) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE':
        await handleSubscriptionActivation({
          supabase,
          appUserId,
          productId,
          originalTransactionId,
          transactionId,
          store,
          purchasedAt,
          expirationAt,
          eventType
        })
        break

      case 'CANCELLATION':
      case 'EXPIRATION':
        await handleSubscriptionDeactivation({
          supabase,
          appUserId,
          originalTransactionId,
          eventType
        })
        break

      case 'BILLING_ISSUE':
        await handleBillingIssue({
          supabase,
          appUserId,
          originalTransactionId
        })
        break

      default:
        console.log('🎯 Unhandled event type:', eventType)
    }

    console.log('🎯 Webhook processed successfully')

    return new Response(
      JSON.stringify({ success: true, processed: eventType }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('🎯 Error processing RevenueCat webhook:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function handleSubscriptionActivation({
  supabase,
  appUserId,
  productId,
  originalTransactionId,
  transactionId,
  store,
  purchasedAt,
  expirationAt,
  eventType
}: {
  supabase: any
  appUserId: string
  productId: string
  originalTransactionId: string
  transactionId: string
  store: string
  purchasedAt: Date
  expirationAt: Date | null
  eventType: string
}) {
  console.log('🎯 Handling subscription activation for user:', appUserId)

  try {
    // Update or create subscriber record
    const { error: subscriberError } = await supabase
      .from('subscribers')
      .upsert({
        user_id: appUserId,
        email: `${appUserId}@revenuecat.user`, // Placeholder email
        subscribed: true,
        subscription_platform: 'revenuecat',
        subscription_tier: productId,
        subscription_end: expirationAt?.toISOString(),
        apple_subscription_id: originalTransactionId,
        original_transaction_id: originalTransactionId,
        latest_transaction_id: transactionId,
        billing_issue: false,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })

    if (subscriberError) {
      console.error('🎯 Error updating subscriber:', subscriberError)
      throw subscriberError
    }

    // Create payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        tourist_user_id: appUserId,
        payment_platform: 'revenuecat',
        product_id: productId,
        apple_transaction_id: transactionId,
        apple_original_transaction_id: originalTransactionId,
        status: 'completed',
        transaction_date: purchasedAt.toISOString(),
        amount: 9.99, // You may want to get this from RevenueCat product info
        platform_fee_amount: 0,
        tour_guide_payout_amount: 0,
        currency: 'usd',
        metadata: {
          event_type: eventType,
          store: store,
          revenuecat_app_user_id: appUserId
        }
      })

    if (paymentError) {
      console.error('🎯 Error creating payment record:', paymentError)
      throw paymentError
    }

    console.log('🎯 Successfully processed subscription activation')

  } catch (error) {
    console.error('🎯 Error in handleSubscriptionActivation:', error)
    throw error
  }
}

async function handleSubscriptionDeactivation({
  supabase,
  appUserId,
  originalTransactionId,
  eventType
}: {
  supabase: any
  appUserId: string
  originalTransactionId: string
  eventType: string
}) {
  console.log('🎯 Handling subscription deactivation for user:', appUserId)

  try {
    // Update subscriber record
    const { error } = await supabase
      .from('subscribers')
      .update({
        subscribed: false,
        subscription_end: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', appUserId)
      .eq('original_transaction_id', originalTransactionId)

    if (error) {
      console.error('🎯 Error updating subscriber for deactivation:', error)
      throw error
    }

    console.log('🎯 Successfully processed subscription deactivation')

  } catch (error) {
    console.error('🎯 Error in handleSubscriptionDeactivation:', error)
    throw error
  }
}

async function handleBillingIssue({
  supabase,
  appUserId,
  originalTransactionId
}: {
  supabase: any
  appUserId: string
  originalTransactionId: string
}) {
  console.log('🎯 Handling billing issue for user:', appUserId)

  try {
    // Update subscriber record to mark billing issue
    const { error } = await supabase
      .from('subscribers')
      .update({
        billing_issue: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', appUserId)
      .eq('original_transaction_id', originalTransactionId)

    if (error) {
      console.error('🎯 Error updating subscriber for billing issue:', error)
      throw error
    }

    console.log('🎯 Successfully processed billing issue')

  } catch (error) {
    console.error('🎯 Error in handleBillingIssue:', error)
    throw error
  }
}