
-- Update the test records to use the current authenticated user's ID
-- This will only update records that have NULL user_id (the test data we just inserted)
UPDATE public.interactions 
SET user_id = auth.uid() 
WHERE user_id IS NULL;
