
-- Drop the existing function first
DROP FUNCTION IF EXISTS public.search_interactions(vector, double precision, integer, uuid);

-- Create the updated search function with all the fields that regular interactions have
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
  interaction_type text,
  landmark_coordinates point,
  landmark_image_url text,
  full_transcript jsonb,
  conversation_id text,
  conversation_duration integer,
  audio_url text,
  agent_id text,
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
    i.interaction_type,
    i.landmark_coordinates,
    i.landmark_image_url,
    i.full_transcript,
    i.conversation_id,
    i.conversation_duration,
    i.audio_url,
    i.agent_id,
    1 - (i.user_input_embedding <=> query_embedding) as similarity
  FROM interactions i
  WHERE i.user_id = search_interactions.user_id
    AND 1 - (i.user_input_embedding <=> query_embedding) > match_threshold
  ORDER BY i.user_input_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
