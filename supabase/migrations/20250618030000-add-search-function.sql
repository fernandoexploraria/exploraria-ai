
-- Create a function to search voice interactions using vector similarity
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
