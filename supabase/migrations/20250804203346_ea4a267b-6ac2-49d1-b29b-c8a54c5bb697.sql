-- Update delete_user_account function to delete interactions
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  tours_anonymized INTEGER := 0;
  payments_anonymized INTEGER := 0;
  tour_stats_deleted INTEGER := 0;
  interactions_deleted INTEGER := 0;
  result JSONB;
BEGIN
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Anonymize generated_tours (preserve business data but remove user association)
  UPDATE public.generated_tours 
  SET user_id = NULL, updated_at = NOW()
  WHERE user_id = target_user_id;
  
  GET DIAGNOSTICS tours_anonymized = ROW_COUNT;

  -- Anonymize payments (preserve business data but remove user association)
  UPDATE public.payments 
  SET tourist_user_id = NULL, updated_at = NOW()
  WHERE tourist_user_id = target_user_id;
  
  GET DIAGNOSTICS payments_anonymized = ROW_COUNT;

  -- Delete user tour stats (this is personal data that should be removed)
  DELETE FROM public.user_tour_stats 
  WHERE user_id = target_user_id;
  
  GET DIAGNOSTICS tour_stats_deleted = ROW_COUNT;

  -- Delete interactions (this is personal conversational data that should be removed)
  DELETE FROM public.interactions 
  WHERE user_id = target_user_id;
  
  GET DIAGNOSTICS interactions_deleted = ROW_COUNT;

  -- Delete user from auth.users (this will CASCADE DELETE all personal data)
  DELETE FROM auth.users WHERE id = target_user_id;

  -- Build result
  result := jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'tours_anonymized', tours_anonymized,
    'payments_anonymized', payments_anonymized,
    'tour_stats_deleted', tour_stats_deleted,
    'interactions_deleted', interactions_deleted,
    'deleted_at', NOW()
  );

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$function$;