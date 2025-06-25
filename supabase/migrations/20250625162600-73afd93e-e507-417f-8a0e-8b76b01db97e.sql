
-- Rename proximity_settings columns to use new naming convention
ALTER TABLE public.proximity_settings 
RENAME COLUMN toast_distance TO notification_distance;

ALTER TABLE public.proximity_settings 
RENAME COLUMN route_distance TO outer_distance;

-- Update default values to match new hierarchy: outer_distance ≥ notification_distance + 50m ≥ card_distance + 25m
-- Default values: outer_distance=250m, notification_distance=100m, card_distance=50m
ALTER TABLE public.proximity_settings 
ALTER COLUMN outer_distance SET DEFAULT 250,
ALTER COLUMN notification_distance SET DEFAULT 100,
ALTER COLUMN card_distance SET DEFAULT 50;

-- Update existing records to use new default values if they don't meet the new hierarchy
UPDATE public.proximity_settings 
SET 
  outer_distance = 250,
  notification_distance = 100,
  card_distance = 50
WHERE 
  outer_distance < notification_distance + 50 
  OR notification_distance < card_distance + 25;
