
-- Remove notification_enabled and sound_enabled columns from proximity_settings table
ALTER TABLE public.proximity_settings 
DROP COLUMN notification_enabled,
DROP COLUMN sound_enabled;

-- Update the trigger function to only set the simplified defaults
CREATE OR REPLACE FUNCTION public.handle_new_user_proximity_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.proximity_settings (
    user_id,
    is_enabled,
    default_distance
  )
  VALUES (
    NEW.id,
    false,
    50
  );
  RETURN NEW;
END;
$$;
