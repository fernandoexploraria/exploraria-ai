
-- Add the three embedding columns for enhanced B2B analytics
ALTER TABLE public.interactions 
ADD COLUMN conversation_summary_embedding vector(768),
ADD COLUMN points_of_interest_embedding vector(768),
ADD COLUMN evaluation_criteria_embedding vector(768);

-- Create indexes for vector similarity search on the new embedding columns
CREATE INDEX ON public.interactions 
USING ivfflat (conversation_summary_embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX ON public.interactions 
USING ivfflat (points_of_interest_embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX ON public.interactions 
USING ivfflat (evaluation_criteria_embedding vector_cosine_ops) 
WITH (lists = 100);
