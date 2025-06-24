
-- Add RLS policies for proximity_settings table
-- Users can view their own proximity settings
CREATE POLICY "Users can view their own proximity settings" 
  ON public.proximity_settings 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can create their own proximity settings
CREATE POLICY "Users can create their own proximity settings" 
  ON public.proximity_settings 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own proximity settings
CREATE POLICY "Users can update their own proximity settings" 
  ON public.proximity_settings 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Users can delete their own proximity settings
CREATE POLICY "Users can delete their own proximity settings" 
  ON public.proximity_settings 
  FOR DELETE 
  USING (auth.uid() = user_id);
