-- Create storage bucket for pre-rendered voice demo audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('voice-demo-audio', 'voice-demo-audio', true);

-- Create permissive policies for the voice demo audio bucket
CREATE POLICY "Voice demo audio files are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'voice-demo-audio');

CREATE POLICY "Allow authenticated users to upload voice demo audio" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'voice-demo-audio' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update voice demo audio" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'voice-demo-audio' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete voice demo audio" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'voice-demo-audio' AND auth.role() = 'authenticated');