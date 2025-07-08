-- Remove is_enabled columns from proximity tables
-- These columns are no longer used since proximity features are always active

-- Remove is_enabled column from proximity_settings table
ALTER TABLE public.proximity_settings DROP COLUMN is_enabled;

-- Remove is_enabled column from proximity_alerts table  
ALTER TABLE public.proximity_alerts DROP COLUMN is_enabled;