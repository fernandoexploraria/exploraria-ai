-- Change the default value of subscription_platform to NULL
-- This will prevent automatic assignment to 'revenuecat' and force explicit platform setting
ALTER TABLE public.subscribers 
ALTER COLUMN subscription_platform SET DEFAULT NULL;