-- Update the trigger function to remove is_enabled parameter
CREATE OR REPLACE FUNCTION public.handle_new_user_proximity_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.proximity_settings (
    user_id,
    notification_distance,
    outer_distance,
    card_distance
  )
  VALUES (
    NEW.id,
    100,
    250,
    50
  );
  RETURN NEW;
END;
$$;