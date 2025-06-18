
-- Enable the vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a table to store voice assistant interactions
CREATE TABLE public.voice_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  destination TEXT NOT NULL,
  user_input TEXT NOT NULL,
  assistant_response TEXT NOT NULL,
  user_input_embedding vector(1536),
  assistant_response_embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS)
ALTER TABLE public.voice_interactions ENABLE ROW LEVEL SECURITY;

-- Create policies for voice interactions
CREATE POLICY "Users can view their own voice interactions" 
  ON public.voice_interactions 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own voice interactions" 
  ON public.voice_interactions 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create index for vector similarity search
CREATE INDEX ON public.voice_interactions 
USING ivfflat (user_input_embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX ON public.voice_interactions 
USING ivfflat (assistant_response_embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create index for user queries
CREATE INDEX ON public.voice_interactions (user_id, created_at DESC);
CREATE INDEX ON public.voice_interactions (destination);
