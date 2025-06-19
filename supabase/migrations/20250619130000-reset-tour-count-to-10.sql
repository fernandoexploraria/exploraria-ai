
-- Reset tour counter for user fobregon67@gmail.com to 10
UPDATE public.user_tour_stats 
SET tour_count = 10, updated_at = now()
WHERE user_id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'fobregon67@gmail.com'
);

-- If no record exists, insert one with tour_count = 10
INSERT INTO public.user_tour_stats (user_id, tour_count, updated_at)
SELECT id, 10, now()
FROM auth.users 
WHERE email = 'fobregon67@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM public.user_tour_stats 
  WHERE user_id = auth.users.id
);
