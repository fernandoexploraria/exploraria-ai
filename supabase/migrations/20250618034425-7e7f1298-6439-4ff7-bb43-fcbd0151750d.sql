
-- Add the missing is_favorite column to voice_interactions table
ALTER TABLE public.voice_interactions 
ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;

-- Ensure RLS policies are properly set up
DROP POLICY IF EXISTS "Users can view their own voice interactions" ON public.voice_interactions;
DROP POLICY IF EXISTS "Users can create their own voice interactions" ON public.voice_interactions;
DROP POLICY IF EXISTS "Users can update their own voice interactions" ON public.voice_interactions;

-- Recreate RLS policies
CREATE POLICY "Users can view their own voice interactions" 
  ON public.voice_interactions 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own voice interactions" 
  ON public.voice_interactions 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voice interactions" 
  ON public.voice_interactions 
  FOR UPDATE 
  USING (auth.uid() = user_id);
