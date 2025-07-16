-- Add experience_count column to user_tour_stats table
ALTER TABLE public.user_tour_stats 
ADD COLUMN experience_count INTEGER NOT NULL DEFAULT 0;

-- Create function to increment experience count
CREATE OR REPLACE FUNCTION public.increment_experience_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  new_count INTEGER;
BEGIN
  -- Insert or update the experience count
  INSERT INTO public.user_tour_stats (user_id, experience_count, updated_at)
  VALUES (p_user_id, 1, now())
  ON CONFLICT (user_id)
  DO UPDATE SET 
    experience_count = user_tour_stats.experience_count + 1,
    updated_at = now()
  RETURNING experience_count INTO new_count;
  
  RETURN new_count;
END;
$function$;