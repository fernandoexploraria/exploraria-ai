-- Fix critical security vulnerability in agent_locations table
-- Restrict access to authenticated users for their own location data only

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Public can view agent locations" ON public.agent_locations;
DROP POLICY IF EXISTS "Public can insert agent locations" ON public.agent_locations;
DROP POLICY IF EXISTS "Public can update agent locations" ON public.agent_locations;

-- Create secure policies that require authentication and user ownership
-- Users can only view their own location data
CREATE POLICY "Users can view their own agent locations" 
ON public.agent_locations 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can only insert location data for themselves
CREATE POLICY "Users can insert their own agent locations" 
ON public.agent_locations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own location data
CREATE POLICY "Users can update their own agent locations" 
ON public.agent_locations 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Allow edge functions to operate with service role key (bypasses RLS)
-- This enables the store-agent-location function to work properly

-- Make user_id NOT NULL since it's now required for security
-- Note: This will require existing data to have user_id populated
ALTER TABLE public.agent_locations 
ALTER COLUMN user_id SET NOT NULL;