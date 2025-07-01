
-- Phase 1: Database Schema Updates for Enhanced Landmark Data Capture

-- Add new fields to generated_landmarks table
ALTER TABLE public.generated_landmarks 
ADD COLUMN raw_data JSONB,
ADD COLUMN price_level INTEGER,
ADD COLUMN user_ratings_total INTEGER,
ADD COLUMN website_uri TEXT,
ADD COLUMN opening_hours JSONB,
ADD COLUMN editorial_summary TEXT,
ADD COLUMN photo_references TEXT[];

-- Remove the unused quality_score column
ALTER TABLE public.generated_landmarks 
DROP COLUMN quality_score;

-- Add helpful comments for the new fields
COMMENT ON COLUMN public.generated_landmarks.raw_data IS 'Complete Google Places API response for this landmark';
COMMENT ON COLUMN public.generated_landmarks.price_level IS 'Google Places price level (0-4)';
COMMENT ON COLUMN public.generated_landmarks.user_ratings_total IS 'Total number of user ratings from Google Places';
COMMENT ON COLUMN public.generated_landmarks.website_uri IS 'Official website URL from Google Places';
COMMENT ON COLUMN public.generated_landmarks.opening_hours IS 'Opening hours data from Google Places API';
COMMENT ON COLUMN public.generated_landmarks.editorial_summary IS 'Editorial summary text from Google Places';
COMMENT ON COLUMN public.generated_landmarks.photo_references IS 'Array of all photo reference IDs from Google Places';
