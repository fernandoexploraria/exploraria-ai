
-- Modify proximity_settings table to replace default_distance with three specific distance fields
ALTER TABLE public.proximity_settings 
DROP COLUMN default_distance;

ALTER TABLE public.proximity_settings 
ADD COLUMN toast_distance INTEGER NOT NULL DEFAULT 100,
ADD COLUMN route_distance INTEGER NOT NULL DEFAULT 250,
ADD COLUMN card_distance INTEGER NOT NULL DEFAULT 50;
