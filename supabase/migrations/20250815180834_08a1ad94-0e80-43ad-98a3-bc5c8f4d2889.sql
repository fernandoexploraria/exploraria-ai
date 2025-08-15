-- Update the handle_new_user function to create subscriber records
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
BEGIN
  -- Create profile (existing logic)
  INSERT INTO public.profiles (
    id, 
    email, 
    role,
    terms_accepted,
    terms_accepted_at
  )
  VALUES (
    NEW.id, 
    NEW.email, 
    'tourist',
    COALESCE((NEW.raw_user_meta_data ->> 'terms_accepted')::boolean, false),
    CASE 
      WHEN (NEW.raw_user_meta_data ->> 'terms_accepted')::boolean = true 
      THEN (NEW.raw_user_meta_data ->> 'terms_accepted_at')::timestamp with time zone 
      ELSE NULL 
    END
  );

  -- Create subscriber record with same defaults as check-subscription function
  INSERT INTO public.subscribers (
    email,
    user_id,
    stripe_customer_id,
    subscribed,
    subscription_tier,
    subscription_end,
    subscription_platform,
    updated_at
  ) VALUES (
    NEW.email,
    NEW.id,
    null,
    false,
    null,
    null,
    null,
    now()
  );

  RETURN NEW;
END;
$$;