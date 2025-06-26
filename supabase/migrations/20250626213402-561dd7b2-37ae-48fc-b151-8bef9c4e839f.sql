
-- Create generated_tours table to store tour-level metadata
CREATE TABLE public.generated_tours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  destination TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  total_landmarks INTEGER NOT NULL DEFAULT 0,
  generation_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  generation_end_time TIMESTAMP WITH TIME ZONE,
  total_processing_time_ms INTEGER,
  coordinate_quality_high INTEGER DEFAULT 0,
  coordinate_quality_medium INTEGER DEFAULT 0,
  coordinate_quality_low INTEGER DEFAULT 0,
  fallbacks_used TEXT[] DEFAULT '{}',
  gemini_api_calls INTEGER DEFAULT 0,
  places_api_calls INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2),
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create generated_landmarks table to store individual landmark analytics
CREATE TABLE public.generated_landmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id UUID REFERENCES public.generated_tours(id) ON DELETE CASCADE NOT NULL,
  landmark_id TEXT NOT NULL,
  name TEXT NOT NULL,
  coordinates POINT NOT NULL,
  description TEXT,
  place_id TEXT,
  coordinate_source TEXT,
  confidence TEXT,
  rating DECIMAL(3,2),
  types TEXT[] DEFAULT '{}',
  formatted_address TEXT,
  photos JSONB,
  search_query TEXT,
  search_attempts INTEGER DEFAULT 1,
  coordinate_refinement_attempts INTEGER DEFAULT 0,
  api_calls_made INTEGER DEFAULT 0,
  fallback_methods_used TEXT[] DEFAULT '{}',
  quality_score DECIMAL(5,2),
  processing_time_ms INTEGER,
  error_messages TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tour_generation_logs table for technical performance metrics
CREATE TABLE public.tour_generation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id UUID REFERENCES public.generated_tours(id) ON DELETE CASCADE NOT NULL,
  log_level TEXT NOT NULL CHECK (log_level IN ('info', 'warning', 'error', 'debug')),
  phase TEXT NOT NULL,
  message TEXT NOT NULL,
  execution_time_ms INTEGER,
  api_endpoint TEXT,
  api_response_code INTEGER,
  api_response_size INTEGER,
  memory_usage_mb DECIMAL(10,2),
  error_details JSONB,
  metadata JSONB,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS) to ensure users can only see their own tour data
ALTER TABLE public.generated_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_landmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_generation_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for generated_tours
CREATE POLICY "Users can view their own tours" 
  ON public.generated_tours 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tours" 
  ON public.generated_tours 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tours" 
  ON public.generated_tours 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- RLS policies for generated_landmarks (inherit from tour)
CREATE POLICY "Users can view landmarks from their tours" 
  ON public.generated_landmarks 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.generated_tours 
    WHERE id = tour_id AND user_id = auth.uid()
  ));

CREATE POLICY "System can create landmarks for user tours" 
  ON public.generated_landmarks 
  FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.generated_tours 
    WHERE id = tour_id AND user_id = auth.uid()
  ));

-- RLS policies for tour_generation_logs (inherit from tour)
CREATE POLICY "Users can view logs from their tours" 
  ON public.tour_generation_logs 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.generated_tours 
    WHERE id = tour_id AND user_id = auth.uid()
  ));

CREATE POLICY "System can create logs for user tours" 
  ON public.tour_generation_logs 
  FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.generated_tours 
    WHERE id = tour_id AND user_id = auth.uid()
  ));

-- Create indexes for performance
CREATE INDEX idx_generated_tours_user_id ON public.generated_tours(user_id);
CREATE INDEX idx_generated_tours_destination ON public.generated_tours(destination);
CREATE INDEX idx_generated_tours_created_at ON public.generated_tours(created_at);

CREATE INDEX idx_generated_landmarks_tour_id ON public.generated_landmarks(tour_id);
CREATE INDEX idx_generated_landmarks_name ON public.generated_landmarks(name);
CREATE INDEX idx_generated_landmarks_coordinate_source ON public.generated_landmarks(coordinate_source);
CREATE INDEX idx_generated_landmarks_confidence ON public.generated_landmarks(confidence);

CREATE INDEX idx_tour_generation_logs_tour_id ON public.tour_generation_logs(tour_id);
CREATE INDEX idx_tour_generation_logs_log_level ON public.tour_generation_logs(log_level);
CREATE INDEX idx_tour_generation_logs_phase ON public.tour_generation_logs(phase);
CREATE INDEX idx_tour_generation_logs_timestamp ON public.tour_generation_logs(timestamp);
