
-- Update the trigger function to properly set all three distance fields with correct defaults
CREATE OR REPLACE FUNCTION public.handle_new_user_proximity_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.proximity_settings (
    user_id,
    is_enabled,
    toast_distance,
    route_distance,
    card_distance
  )
  VALUES (
    NEW.id,
    false,
    100,
    250,
    50
  );
  RETURN NEW;
END;
$$;
