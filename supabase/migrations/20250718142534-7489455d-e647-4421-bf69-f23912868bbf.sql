-- Add stripe_cancel_at_period_end and stripe_status columns to subscribers table
ALTER TABLE public.subscribers 
ADD COLUMN stripe_cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN stripe_status TEXT DEFAULT NULL;

-- Add indexes for better performance when querying by these fields
CREATE INDEX idx_subscribers_cancel_at_period_end ON public.subscribers(stripe_cancel_at_period_end);
CREATE INDEX idx_subscribers_stripe_status ON public.subscribers(stripe_status);

-- Add comments to document the new columns
COMMENT ON COLUMN public.subscribers.stripe_cancel_at_period_end IS 'Whether the subscription is set to cancel at the end of the current period';
COMMENT ON COLUMN public.subscribers.stripe_status IS 'Current status of the Stripe subscription (active, canceled, past_due, etc.)';