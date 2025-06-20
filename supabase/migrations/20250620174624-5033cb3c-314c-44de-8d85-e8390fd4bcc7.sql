
-- Update the cleanup function to use the correct table name
CREATE OR REPLACE FUNCTION public.cleanup_all_data()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  interactions_count INTEGER;
  tour_stats_count INTEGER;
  subscribers_count INTEGER;
  users_count INTEGER;
BEGIN
  -- Count records before deletion for reporting
  SELECT COUNT(*) INTO interactions_count FROM public.interactions;
  SELECT COUNT(*) INTO tour_stats_count FROM public.user_tour_stats;
  SELECT COUNT(*) INTO subscribers_count FROM public.subscribers;
  SELECT COUNT(*) INTO users_count FROM auth.users;
  
  -- Delete all data from child tables that reference users
  -- This will clean up all user-related data before deleting the users themselves
  
  -- Delete all interactions
  DELETE FROM public.interactions;
  
  -- Delete all user tour stats
  DELETE FROM public.user_tour_stats;
  
  -- Delete all subscriber records
  DELETE FROM public.subscribers;
  
  -- Finally, delete all users from the auth.users table
  -- This should be done last to avoid foreign key constraint issues
  DELETE FROM auth.users;
  
  -- Return summary of what was deleted
  RETURN FORMAT('Cleanup completed successfully. Deleted: %s interactions, %s tour stats, %s subscribers, %s users', 
                interactions_count, tour_stats_count, subscribers_count, users_count);
END;
$$;
