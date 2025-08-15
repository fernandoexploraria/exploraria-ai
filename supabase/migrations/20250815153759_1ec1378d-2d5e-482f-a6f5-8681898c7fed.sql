-- Remove the default value for payment_platform to force explicit setting
ALTER TABLE public.payments 
ALTER COLUMN payment_platform DROP DEFAULT;