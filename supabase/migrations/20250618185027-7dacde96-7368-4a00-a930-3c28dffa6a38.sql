
-- Enable the required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily subscription check at 2 AM UTC
SELECT cron.schedule(
  'daily-subscription-check',
  '0 2 * * *', -- Every day at 2 AM UTC
  $$
  SELECT
    net.http_post(
        url:='https://ejqgdmbuabrcjxbhpxup.supabase.co/functions/v1/daily-subscription-check',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcWdkbWJ1YWJyY2p4YmhweHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMTUzMTYsImV4cCI6MjA2NTY5MTMxNn0.vMKdS0ToOOq_RELS-IhSUPYEx6-qkLWoqEBYfYIt8iY"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);
