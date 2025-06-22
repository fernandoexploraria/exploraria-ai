
-- Create table for storing shortened URL mappings
CREATE TABLE public.shared_urls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  short_code TEXT NOT NULL UNIQUE,
  original_url TEXT NOT NULL,
  url_type TEXT NOT NULL CHECK (url_type IN ('image', 'interaction')),
  interaction_id UUID REFERENCES public.interactions(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for fast lookups by short_code
CREATE INDEX idx_shared_urls_short_code ON public.shared_urls(short_code);

-- Add index for interaction_id lookups
CREATE INDEX idx_shared_urls_interaction_id ON public.shared_urls(interaction_id);

-- Enable Row Level Security
ALTER TABLE public.shared_urls ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read shared URLs (they're meant to be public)
CREATE POLICY "Anyone can view shared URLs" 
  ON public.shared_urls 
  FOR SELECT 
  TO public
  USING (true);

-- Create policy to allow authenticated users to create shared URLs
CREATE POLICY "Authenticated users can create shared URLs" 
  ON public.shared_urls 
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);
