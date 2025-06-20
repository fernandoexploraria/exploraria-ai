
-- Update the voice_interactions table to use 768-dimensional embeddings for Gemini
ALTER TABLE public.voice_interactions 
DROP COLUMN user_input_embedding,
DROP COLUMN assistant_response_embedding;

-- Add new embedding columns with 768 dimensions for Gemini
ALTER TABLE public.voice_interactions 
ADD COLUMN user_input_embedding vector(768),
ADD COLUMN assistant_response_embedding vector(768);

-- Recreate indexes for the new embedding dimensions
DROP INDEX IF EXISTS voice_interactions_user_input_embedding_idx;
DROP INDEX IF EXISTS voice_interactions_assistant_response_embedding_idx;

-- Create new indexes for vector similarity search with 768 dimensions
CREATE INDEX ON public.voice_interactions 
USING ivfflat (user_input_embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX ON public.voice_interactions 
USING ivfflat (assistant_response_embedding vector_cosine_ops) 
WITH (lists = 100);

-- Update the search function to work with 768-dimensional embeddings
CREATE OR REPLACE FUNCTION search_voice_interactions(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  user_id uuid
)
RETURNS TABLE (
  id uuid,
  destination text,
  user_input text,
  assistant_response text,
  is_favorite boolean,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vi.id,
    vi.destination,
    vi.user_input,
    vi.assistant_response,
    vi.is_favorite,
    vi.created_at,
    1 - (vi.user_input_embedding <=> query_embedding) as similarity
  FROM voice_interactions vi
  WHERE vi.user_id = search_voice_interactions.user_id
    AND 1 - (vi.user_input_embedding <=> query_embedding) > match_threshold
  ORDER BY vi.user_input_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
