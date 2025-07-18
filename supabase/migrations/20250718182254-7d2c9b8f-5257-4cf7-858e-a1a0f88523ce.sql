-- Add tracking fields to profiles table for Travel Expert upgrade card display logic
ALTER TABLE public.profiles 
ADD COLUMN upgrade_card_dismissed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN first_login_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN session_count INTEGER DEFAULT 1;