-- Add product_id field to generated_tours table for Stripe integration
ALTER TABLE public.generated_tours 
ADD COLUMN product_id TEXT;