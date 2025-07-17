-- Add stripe_subscription_id column to subscribers table
ALTER TABLE public.subscribers 
ADD COLUMN stripe_subscription_id TEXT;

-- Add index for better performance when querying by stripe_subscription_id
CREATE INDEX idx_subscribers_stripe_subscription_id ON public.subscribers(stripe_subscription_id);

-- Add comment to document the new column
COMMENT ON COLUMN public.subscribers.stripe_subscription_id IS 'Stripe subscription ID for direct reference to Stripe subscription object';