
-- Remove the landmark_audio_url column since we're generating audio on-demand
ALTER TABLE public.interactions 
DROP COLUMN landmark_audio_url;
