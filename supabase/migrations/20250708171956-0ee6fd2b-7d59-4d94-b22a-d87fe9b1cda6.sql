-- Update default value for is_enabled column to true
ALTER TABLE public.proximity_settings 
ALTER COLUMN is_enabled SET DEFAULT true;

-- Update the trigger function to set is_enabled to true for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_proximity_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.proximity_settings (
    user_id,
    is_enabled,
    notification_distance,
    outer_distance,
    card_distance
  )
  VALUES (
    NEW.id,
    true,
    100,
    250,
    50
  );
  RETURN NEW;
END;
$$;