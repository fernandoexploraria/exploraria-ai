
-- Add a favorites column to the voice_interactions table
ALTER TABLE public.voice_interactions 
ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE;

-- Create an index for faster favorite queries
CREATE INDEX ON public.voice_interactions (user_id, is_favorite) WHERE is_favorite = TRUE;

-- Add policy for updating favorites
CREATE POLICY "Users can update their own voice interactions" 
  ON public.voice_interactions 
  FOR UPDATE 
  USING (auth.uid() = user_id);
