
-- Get your user ID and update the test records
-- First, let's see what user IDs exist in the database
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Get the first available user ID from the auth.users table
    SELECT id INTO target_user_id
    FROM auth.users
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If we found a user, update the NULL user_id records
    IF target_user_id IS NOT NULL THEN
        UPDATE public.interactions 
        SET user_id = target_user_id 
        WHERE user_id IS NULL;
        
        RAISE NOTICE 'Updated % records with user_id: %', 
            (SELECT COUNT(*) FROM public.interactions WHERE user_id = target_user_id),
            target_user_id;
    ELSE
        RAISE NOTICE 'No users found in auth.users table';
    END IF;
END $$;
