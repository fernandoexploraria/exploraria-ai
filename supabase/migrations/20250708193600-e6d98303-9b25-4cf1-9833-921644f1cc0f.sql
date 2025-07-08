-- Enable RLS on agent_locations table
ALTER TABLE public.agent_locations ENABLE ROW LEVEL SECURITY;

-- Allow public SELECT access (for get-place-directions and other functions)
CREATE POLICY "Public can view agent locations" 
ON public.agent_locations 
FOR SELECT 
USING (true);

-- Allow public INSERT access (for store-agent-location function)
CREATE POLICY "Public can insert agent locations" 
ON public.agent_locations 
FOR INSERT 
WITH CHECK (true);

-- Allow public UPDATE access (for store-agent-location function)
CREATE POLICY "Public can update agent locations" 
ON public.agent_locations 
FOR UPDATE 
USING (true);