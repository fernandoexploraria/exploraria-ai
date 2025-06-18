
-- Delete all data from child tables that reference users
-- This will clean up all user-related data before deleting the users themselves

-- Delete all voice interactions
DELETE FROM public.voice_interactions;

-- Delete all user tour stats
DELETE FROM public.user_tour_stats;

-- Delete all subscriber records
DELETE FROM public.subscribers;

-- Finally, delete all users from the auth.users table
-- This should be done last to avoid foreign key constraint issues
DELETE FROM auth.users;
