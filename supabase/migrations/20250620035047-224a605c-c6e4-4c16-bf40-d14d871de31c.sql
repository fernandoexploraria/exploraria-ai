
-- Drop the existing function and recreate it with the corrected parameter name
DROP FUNCTION IF EXISTS public.increment_tour_count(uuid);

-- Create the function with a non-ambiguous parameter name
CREATE OR REPLACE FUNCTION public.increment_tour_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  -- Insert or update the tour count
  INSERT INTO public.user_tour_stats (user_id, tour_count, updated_at)
  VALUES (p_user_id, 1, now())
  ON CONFLICT (user_id)
  DO UPDATE SET 
    tour_count = user_tour_stats.tour_count + 1,
    updated_at = now()
  RETURNING tour_count INTO new_count;
  
  RETURN new_count;
END;
$$;
