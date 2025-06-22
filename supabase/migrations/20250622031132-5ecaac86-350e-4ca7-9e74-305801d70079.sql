
-- Add summary column to interactions table
ALTER TABLE public.interactions 
ADD COLUMN conversation_summary TEXT;

-- Add index for summary searches if needed
CREATE INDEX idx_interactions_summary ON public.interactions USING gin(to_tsvector('english', conversation_summary));
