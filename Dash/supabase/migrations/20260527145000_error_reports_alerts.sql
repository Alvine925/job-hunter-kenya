-- Migration: Update error_reports RLS policies and wire error notification Edge Function triggers via pg_net.
-- Allows public/anonymous inserts so that preflight, bootstrap, and login-screen failures can be logged.
-- Automatically sends an async email notification alert to administrators for every captured error.

-- 1. Relax Row Level Security on error_reports to allow global background logging
DROP POLICY IF EXISTS "Allow authenticated insert of own reports" ON public.error_reports;
DROP POLICY IF EXISTS "Allow anonymous and authenticated insert" ON public.error_reports;

CREATE POLICY "Allow anonymous and authenticated insert"
  ON public.error_reports FOR INSERT
  WITH CHECK (true);

-- 2. Create the Trigger Function to call the error-notification Edge Function
CREATE OR REPLACE FUNCTION public.trigger_error_report_emails()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_url TEXT := 'https://eqkctzjyqmafpytvdepf.supabase.co';
  payload TEXT;
BEGIN
  -- Build comprehensive error report JSON payload
  payload := json_build_object(
    'record', json_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'error_message', NEW.error_message,
      'error_stack', NEW.error_stack,
      'section', NEW.section,
      'action_context', NEW.action_context,
      'user_description', NEW.user_description,
      'created_at', NEW.created_at
    )
  )::text;

  -- Fire async HTTP POST call to the error-notification edge function (non-blocking)
  PERFORM net.http_post(
    url := base_url || '/functions/v1/error-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'tellus_secret_webhook_token_2026'
    ),
    body := payload::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Prevent database failures if the notification webhook fails
  RAISE WARNING 'trigger_error_report_emails failed for report %: [%] %', NEW.id, SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$;

-- 3. Attach the trigger to error_reports table (fires AFTER INSERT on every logged error)
DROP TRIGGER IF EXISTS on_error_reported_send_emails ON public.error_reports;
CREATE TRIGGER on_error_reported_send_emails
  AFTER INSERT ON public.error_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_error_report_emails();
