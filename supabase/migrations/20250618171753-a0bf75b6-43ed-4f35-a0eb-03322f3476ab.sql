
-- Create a table to track user tour statistics
CREATE TABLE public.user_tour_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  tour_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Add Row Level Security (RLS)
ALTER TABLE public.user_tour_stats ENABLE ROW LEVEL SECURITY;

-- Create policy that allows users to view their own stats
CREATE POLICY "Users can view their own tour stats" 
  ON public.user_tour_stats 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy that allows users to insert their own stats
CREATE POLICY "Users can create their own tour stats" 
  ON public.user_tour_stats 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create policy that allows users to update their own stats
CREATE POLICY "Users can update their own tour stats" 
  ON public.user_tour_stats 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create function to increment tour count
CREATE OR REPLACE FUNCTION public.increment_tour_count(user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  -- Insert or update the tour count
  INSERT INTO public.user_tour_stats (user_id, tour_count, updated_at)
  VALUES (user_id, 1, now())
  ON CONFLICT (user_id)
  DO UPDATE SET 
    tour_count = user_tour_stats.tour_count + 1,
    updated_at = now()
  RETURNING tour_count INTO new_count;
  
  RETURN new_count;
END;
$$;
