-- Add Apple Pay support to existing payment tables
-- This enables storing Apple subscription data alongside existing Stripe data

-- Add Apple-specific fields to payments table
ALTER TABLE public.payments 
ADD COLUMN apple_transaction_id TEXT,
ADD COLUMN apple_original_transaction_id TEXT,
ADD COLUMN apple_receipt_data TEXT;

-- Add Apple subscription tracking to subscribers table  
ALTER TABLE public.subscribers
ADD COLUMN apple_subscription_id TEXT;

-- Add indexes for efficient Apple transaction lookups
CREATE INDEX idx_payments_apple_transaction_id ON public.payments(apple_transaction_id) WHERE apple_transaction_id IS NOT NULL;
CREATE INDEX idx_payments_apple_original_transaction_id ON public.payments(apple_original_transaction_id) WHERE apple_original_transaction_id IS NOT NULL;
CREATE INDEX idx_subscribers_apple_subscription_id ON public.subscribers(apple_subscription_id) WHERE apple_subscription_id IS NOT NULL;