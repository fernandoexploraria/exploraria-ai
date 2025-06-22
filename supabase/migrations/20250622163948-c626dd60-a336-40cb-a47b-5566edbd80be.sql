
-- Add proximity-specific columns to the interactions table
ALTER TABLE public.interactions 
ADD COLUMN discovery_distance INTEGER,
ADD COLUMN transportation_mode TEXT CHECK (transportation_mode IN ('walking', 'driving')),
ADD COLUMN user_location POINT;

-- Create index for proximity queries
CREATE INDEX idx_interactions_proximity ON public.interactions (interaction_type, discovery_distance) WHERE interaction_type = 'proximity';

-- Create index for user location queries (useful for proximity analysis)
CREATE INDEX idx_interactions_user_location ON public.interactions USING GIST (user_location) WHERE user_location IS NOT NULL;
