
-- Update default values in the proximity_settings table to match new requirements
ALTER TABLE public.proximity_settings 
ALTER COLUMN default_distance SET DEFAULT 50,
ALTER COLUMN is_enabled SET DEFAULT false,
ALTER COLUMN notification_enabled SET DEFAULT false,
ALTER COLUMN sound_enabled SET DEFAULT false;

-- Create function to handle new user proximity settings creation
CREATE OR REPLACE FUNCTION public.handle_new_user_proximity_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.proximity_settings (
    user_id,
    is_enabled,
    default_distance,
    notification_enabled,
    sound_enabled
  )
  VALUES (
    NEW.id,
    false,
    50,
    false,
    false
  );
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create proximity settings for new users
CREATE TRIGGER on_auth_user_created_proximity_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_proximity_settings();
