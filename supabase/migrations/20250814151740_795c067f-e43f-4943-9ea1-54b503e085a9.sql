-- Add RevenueCat-specific fields to subscribers table
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS original_transaction_id TEXT UNIQUE;
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS latest_transaction_id TEXT;
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS billing_issue BOOLEAN DEFAULT FALSE;
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS subscription_platform TEXT DEFAULT 'revenuecat';

-- Add RevenueCat fields to payments table  
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_platform TEXT DEFAULT 'revenuecat';

-- Create index for RevenueCat transaction lookups
CREATE INDEX IF NOT EXISTS idx_payments_apple_transaction_id ON public.payments(apple_transaction_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_original_transaction_id ON public.subscribers(original_transaction_id);