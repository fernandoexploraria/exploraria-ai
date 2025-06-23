
-- Create a table to store proximity notification history
CREATE TABLE public.proximity_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  landmark_id TEXT NOT NULL,
  landmark_name TEXT NOT NULL,
  distance DECIMAL NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'proximity_alert',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS)
ALTER TABLE public.proximity_notifications ENABLE ROW LEVEL SECURITY;

-- Create policy that allows users to view their own notifications
CREATE POLICY "Users can view their own proximity notifications" 
  ON public.proximity_notifications 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy that allows users to insert their own notifications
CREATE POLICY "Users can create their own proximity notifications" 
  ON public.proximity_notifications 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_proximity_notifications_user_id_created_at 
  ON public.proximity_notifications (user_id, created_at DESC);

CREATE INDEX idx_proximity_notifications_user_landmark 
  ON public.proximity_notifications (user_id, landmark_id, created_at DESC);
