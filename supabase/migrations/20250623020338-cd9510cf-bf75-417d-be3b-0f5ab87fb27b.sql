
-- Update all existing proximity_settings to metric and set default distances in meters
UPDATE public.proximity_settings 
SET unit = 'metric', 
    default_distance = CASE 
      WHEN unit = 'imperial' THEN ROUND(default_distance / 3.28084)::integer 
      ELSE default_distance 
    END,
    updated_at = now();

-- Update all existing proximity_alerts to metric and convert distances
UPDATE public.proximity_alerts 
SET unit = 'metric',
    distance = CASE 
      WHEN unit = 'imperial' THEN ROUND(distance / 3.28084)::integer 
      ELSE distance 
    END,
    updated_at = now();

-- Add check constraints to ensure only metric units are used going forward
ALTER TABLE public.proximity_settings 
ADD CONSTRAINT proximity_settings_unit_metric_only 
CHECK (unit = 'metric');

ALTER TABLE public.proximity_alerts 
ADD CONSTRAINT proximity_alerts_unit_metric_only 
CHECK (unit = 'metric');

-- Set default values to metric for new records
ALTER TABLE public.proximity_settings 
ALTER COLUMN unit SET DEFAULT 'metric';

ALTER TABLE public.proximity_alerts 
ALTER COLUMN unit SET DEFAULT 'metric';
