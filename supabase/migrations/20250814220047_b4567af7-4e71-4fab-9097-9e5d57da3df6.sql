-- Add Apple subscription fields to subscribers table if they don't exist
ALTER TABLE public.subscribers 
ADD COLUMN IF NOT EXISTS subscription_platform TEXT DEFAULT 'revenuecat',
ADD COLUMN IF NOT EXISTS apple_original_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS latest_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS apple_receipt_data TEXT;