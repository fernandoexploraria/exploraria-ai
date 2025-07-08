-- Create new agent_locations table to replace user_locations
-- This table will store location data per conversation_id instead of user_id
CREATE TABLE public.agent_locations (
  conversation_id TEXT NOT NULL PRIMARY KEY,
  user_id UUID NULL, -- For analytics only
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(6, 2),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- No RLS policies needed - table should be publicly accessible
-- This allows the edge function to use anon key instead of service role key

-- Create indexes for performance
CREATE INDEX idx_agent_locations_conversation_id ON public.agent_locations(conversation_id);
CREATE INDEX idx_agent_locations_user_id ON public.agent_locations(user_id); -- For analytics queries
CREATE INDEX idx_agent_locations_updated_at ON public.agent_locations(updated_at);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_agent_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_agent_locations_updated_at
BEFORE UPDATE ON public.agent_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_agent_locations_updated_at();

-- Drop the old user_locations table (after confirming no dependencies)
DROP TABLE IF EXISTS public.user_locations;