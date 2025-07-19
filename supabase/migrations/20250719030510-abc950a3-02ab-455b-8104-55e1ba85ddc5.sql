
-- Add Stripe Connect fields to the profiles table
ALTER TABLE public.profiles 
ADD COLUMN stripe_account_id TEXT,
ADD COLUMN stripe_account_status TEXT NOT NULL DEFAULT 'not_started',
ADD COLUMN stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN stripe_charges_enabled BOOLEAN NOT NULL DEFAULT false;

-- Add check constraint for valid account statuses
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_stripe_account_status_check 
CHECK (stripe_account_status IN ('not_started', 'pending_info', 'pending_verification', 'active', 'restricted'));

-- Add index for efficient queries on stripe_account_id
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_account_id ON public.profiles(stripe_account_id);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.stripe_account_id IS 'Stripe Express Account ID (acct_...). Null until connected.';
COMMENT ON COLUMN public.profiles.stripe_account_status IS 'Overall status: not_started, pending_info, pending_verification, active, restricted';
COMMENT ON COLUMN public.profiles.stripe_payouts_enabled IS 'Whether the account can receive payouts from Stripe';
COMMENT ON COLUMN public.profiles.stripe_charges_enabled IS 'Whether the account can accept charges through Stripe';
