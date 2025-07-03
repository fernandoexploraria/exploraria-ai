
-- Add location_settling_grace_period field to proximity_settings table
ALTER TABLE public.proximity_settings 
ADD COLUMN location_settling_grace_period integer NOT NULL DEFAULT 5000;

-- Add comment to document the field
COMMENT ON COLUMN public.proximity_settings.location_settling_grace_period IS 'Grace period in milliseconds to wait for location to stabilize after acquisition (1000-15000ms range)';
