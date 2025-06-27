
-- Add RLS policies for generated_tours table
CREATE POLICY "Users can view their own generated tours" 
  ON public.generated_tours 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own generated tours" 
  ON public.generated_tours 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generated tours" 
  ON public.generated_tours 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Add the missing RLS policy for generated_landmarks table (INSERT only)
CREATE POLICY "Users can create landmarks for their tours" 
  ON public.generated_landmarks 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.generated_tours 
      WHERE generated_tours.id = generated_landmarks.tour_id 
      AND generated_tours.user_id = auth.uid()
    )
  );

-- Enable RLS on both tables
ALTER TABLE public.generated_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_landmarks ENABLE ROW LEVEL SECURITY;
