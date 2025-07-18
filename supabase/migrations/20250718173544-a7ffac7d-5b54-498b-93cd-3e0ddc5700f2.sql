-- Create profiles table for storing user roles and additional info
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'tourist' NOT NULL CHECK (role IN ('tourist', 'travel_expert')),
  full_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles table
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Function to create profile when new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'tourist');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function after a new user is inserted
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_profiles_updated_at();

-- Custom JWT claims function to include role in JWT
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
  user_email text;
BEGIN
  -- Get user role and email from profiles table
  SELECT role, email INTO user_role, user_email 
  FROM public.profiles 
  WHERE id = (event->>'user_id')::uuid;
  
  -- Add role to the JWT claims
  event := jsonb_set(event, ARRAY['claims', 'user_metadata', 'role'], to_jsonb(user_role));
  event := jsonb_set(event, ARRAY['claims', 'user_metadata', 'email'], to_jsonb(user_email));
  
  RETURN event;
END;
$$;

-- Update existing tables RLS policies to respect roles
-- Update generated_tours policies to allow travel_experts to manage their tours
CREATE POLICY "Travel experts can create tours" ON public.generated_tours
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'travel_expert')
  );

CREATE POLICY "Travel experts can update their own tours" ON public.generated_tours
  FOR UPDATE USING (
    auth.uid() = user_id AND 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'travel_expert')
  );

-- Update payments policies to allow travel_experts to view their earnings
CREATE POLICY "Travel experts can view their tour payments" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.generated_tours gt, public.profiles p
      WHERE gt.id = payments.tour_id 
      AND gt.user_id = p.id 
      AND p.id = auth.uid() 
      AND p.role = 'travel_expert'
    )
  );