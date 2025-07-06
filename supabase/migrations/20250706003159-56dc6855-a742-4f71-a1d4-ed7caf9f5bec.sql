-- Add composite index for faster joins between generated_landmarks and generated_tours
CREATE INDEX IF NOT EXISTS idx_generated_landmarks_tour_place 
ON generated_landmarks(tour_id, place_id);

-- Add index for chronological queries on generated_landmarks
CREATE INDEX IF NOT EXISTS idx_generated_landmarks_created_at 
ON generated_landmarks(created_at DESC);

-- Add index for better performance on landmark queries by place_id
CREATE INDEX IF NOT EXISTS idx_generated_landmarks_place_id 
ON generated_landmarks(place_id) WHERE place_id IS NOT NULL;