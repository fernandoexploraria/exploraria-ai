
-- Add new columns to support map marker interactions
ALTER TABLE public.voice_interactions 
ADD COLUMN interaction_type TEXT DEFAULT 'voice' CHECK (interaction_type IN ('voice', 'map_marker', 'image_recognition')),
ADD COLUMN landmark_coordinates POINT,
ADD COLUMN landmark_image_url TEXT,
ADD COLUMN landmark_audio_url TEXT;

-- Create index for geolocation queries (useful for nearby searches)
CREATE INDEX idx_voice_interactions_coordinates ON public.voice_interactions USING GIST (landmark_coordinates);

-- Create index for interaction type filtering
CREATE INDEX idx_voice_interactions_type ON public.voice_interactions (interaction_type);
