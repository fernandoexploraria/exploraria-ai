
-- Create a storage bucket for static assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'static-assets',
  'static-assets', 
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Create policy to allow public read access to static assets
CREATE POLICY "Public read access for static assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'static-assets');

-- Create policy to allow authenticated users to upload static assets
CREATE POLICY "Authenticated users can upload static assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'static-assets' AND auth.role() = 'authenticated');
