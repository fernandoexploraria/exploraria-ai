-- Add RLS policy to allow anyone to view landmarks from experience tours
CREATE POLICY "Anyone can view landmarks from experience tours" 
  ON public.generated_landmarks 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 
    FROM generated_tours 
    WHERE generated_tours.id = generated_landmarks.tour_id 
    AND generated_tours.experience = true
  ));