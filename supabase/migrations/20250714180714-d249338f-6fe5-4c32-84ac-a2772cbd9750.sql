-- Add account_id and product_id fields to generated_tours table
ALTER TABLE public.generated_tours 
ADD COLUMN account_id TEXT,
ADD COLUMN product_id TEXT;