-- Add account_id field to generated_tours table
ALTER TABLE public.generated_tours 
ADD COLUMN account_id TEXT;