-- Optional hourly GitHub repository sync scheduler.
-- Replace YOUR_PROJECT_REF and YOUR_SUPABASE_SERVICE_ROLE_KEY before running.
-- Requires pg_cron and pg_net extensions enabled in Supabase.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'org-context-github-sync-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://mplhdgoddipbtujpjqgt.supabase.co/functions/v1/github-sync-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbGhkZ29kZGlwYnR1anBqcWd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzA5MjQxOCwiZXhwIjoyMDkyNjY4NDE4fQ.Np-aWAb0V9A5EGykle4ShCOmzxwuCyzptmzPeul9bSo',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
