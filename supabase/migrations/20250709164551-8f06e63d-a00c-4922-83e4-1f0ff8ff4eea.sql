-- Update proximity_settings table column defaults
ALTER TABLE public.proximity_settings 
ALTER COLUMN notification_distance SET DEFAULT 250;

ALTER TABLE public.proximity_settings 
ALTER COLUMN outer_distance SET DEFAULT 1000;

-- Update the trigger function to use new default values
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
    250,
    1000,
    50
  );
  RETURN NEW;
END;
$$;