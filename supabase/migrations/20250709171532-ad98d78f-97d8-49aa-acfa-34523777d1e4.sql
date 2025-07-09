-- Add all four new columns to generated_tours
ALTER TABLE public.generated_tours 
ADD COLUMN description text DEFAULT '' NOT NULL,
ADD COLUMN photo jsonb DEFAULT null,
ADD COLUMN experience boolean DEFAULT false NOT NULL,
ADD COLUMN agentId text DEFAULT null;

-- Add new RLS policy for public access to experience tours
CREATE POLICY "Anyone can view experience tours" 
ON public.generated_tours 
FOR SELECT 
USING (experience = true);