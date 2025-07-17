-- Add payment_type and stripe_subscription_id fields to payments table

-- Step 1: Add payment_type field (to distinguish between experience payments and subscription payments)
ALTER TABLE public.payments 
ADD COLUMN payment_type TEXT;

-- Step 2: Add stripe_subscription_id field (to track subscription payments)
ALTER TABLE public.payments 
ADD COLUMN stripe_subscription_id TEXT;

-- Step 3: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_payment_type ON public.payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_subscription_id ON public.payments(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;