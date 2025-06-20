
-- Rename the table from voice_interactions to interactions
ALTER TABLE public.voice_interactions RENAME TO interactions;

-- Update the search function name and references
DROP FUNCTION IF EXISTS public.search_voice_interactions(vector, double precision, integer, uuid);

CREATE OR REPLACE FUNCTION public.search_interactions(
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
    i.id,
    i.destination,
    i.user_input,
    i.assistant_response,
    i.is_favorite,
    i.created_at,
    1 - (i.user_input_embedding <=> query_embedding) as similarity
  FROM interactions i
  WHERE i.user_id = search_interactions.user_id
    AND 1 - (i.user_input_embedding <=> query_embedding) > match_threshold
  ORDER BY i.user_input_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Update index names to reflect the new table name
ALTER INDEX idx_voice_interactions_coordinates RENAME TO idx_interactions_coordinates;
ALTER INDEX idx_voice_interactions_type RENAME TO idx_interactions_type;
