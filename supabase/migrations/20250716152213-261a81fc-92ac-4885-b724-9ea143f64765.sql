-- Enable real-time updates for user_tour_stats table
ALTER TABLE public.user_tour_stats REPLICA IDENTITY FULL;

-- Add the table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_tour_stats;