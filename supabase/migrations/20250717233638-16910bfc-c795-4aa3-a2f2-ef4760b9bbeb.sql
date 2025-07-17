-- Migration to make payments table more flexible for subscription payments

-- Step 1: Drop the foreign key constraint on tour_id
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_tour_id_fkey;

-- Step 2: Make tour_id nullable (allow NULL for subscription payments)
ALTER TABLE public.payments ALTER COLUMN tour_id DROP NOT NULL;

-- Step 3: Make tour_guide_id nullable (allow NULL for subscription payments)
ALTER TABLE public.payments ALTER COLUMN tour_guide_id DROP NOT NULL;

-- Step 4: Update RLS policy to handle nullable tour_id values
DROP POLICY IF EXISTS "Users can view payments for their tours as guides" ON public.payments;

CREATE POLICY "Users can view payments for their tours as guides" 
ON public.payments 
FOR SELECT 
USING (
  tour_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.generated_tours 
    WHERE id = payments.tour_id 
    AND user_id = auth.uid()
  )
);

-- Step 5: Optimize indexes (remove old foreign key index, keep useful ones)
-- The foreign key index will be automatically dropped with the constraint
-- Keep the existing useful indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_tour_id_not_null ON public.payments(tour_id) WHERE tour_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_tour_guide_id_not_null ON public.payments(tour_guide_id) WHERE tour_guide_id IS NOT NULL;