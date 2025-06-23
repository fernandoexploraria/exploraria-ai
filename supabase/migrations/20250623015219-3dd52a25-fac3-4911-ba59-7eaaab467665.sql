
-- Enable real-time updates for proximity_settings table
ALTER TABLE public.proximity_settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.proximity_settings;
