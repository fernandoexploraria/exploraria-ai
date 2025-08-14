-- Add unique constraint to user_id column in subscribers table
ALTER TABLE public.subscribers 
ADD CONSTRAINT subscribers_user_id_unique UNIQUE (user_id);