
-- Create proximity_alerts table
CREATE TABLE public.proximity_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  landmark_id TEXT NOT NULL,
  distance INTEGER NOT NULL DEFAULT 100, -- distance in meters
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  unit TEXT NOT NULL DEFAULT 'metric' CHECK (unit IN ('metric', 'imperial')),
  last_triggered TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, landmark_id)
);

-- Create proximity_settings table for user preferences
CREATE TABLE public.proximity_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  default_distance INTEGER NOT NULL DEFAULT 100,
  unit TEXT NOT NULL DEFAULT 'metric' CHECK (unit IN ('metric', 'imperial')),
  notification_enabled BOOLEAN NOT NULL DEFAULT true,
  sound_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.proximity_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proximity_settings ENABLE ROW LEVEL SECURITY;

-- Policies for proximity_alerts
CREATE POLICY "Users can manage their own proximity alerts" 
  ON public.proximity_alerts 
  FOR ALL 
  USING (auth.uid() = user_id);

-- Policies for proximity_settings
CREATE POLICY "Users can manage their own proximity settings" 
  ON public.proximity_settings 
  FOR ALL 
  USING (auth.uid() = user_id);
