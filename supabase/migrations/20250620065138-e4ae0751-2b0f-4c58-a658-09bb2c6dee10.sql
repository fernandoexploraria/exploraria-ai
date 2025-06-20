
-- Add columns to support ElevenLabs webhook data
ALTER TABLE public.voice_interactions 
ADD COLUMN conversation_id TEXT,
ADD COLUMN conversation_duration INTEGER,
ADD COLUMN audio_url TEXT,
ADD COLUMN agent_id TEXT,
ADD COLUMN full_transcript JSONB;

-- Create index for conversation_id lookups
CREATE INDEX idx_voice_interactions_conversation_id ON public.voice_interactions (conversation_id);

-- Add a policy for webhook access (we'll make the webhook function public)
-- The existing RLS policies will still protect user data access
