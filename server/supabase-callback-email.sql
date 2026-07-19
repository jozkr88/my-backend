-- Supabase callback email trigger
--
-- Before running:
-- 1. Replace the function URL if your Supabase project ref changes.
-- 2. Replace the webhook secret below if you rotate
--    the Edge Function secret `CALLBACK_WEBHOOK_SECRET`.
--
-- This trigger posts each new `joz_callback_requests` row to the Edge Function.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_callback_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://qejpieeshtuickbpxbbp.supabase.co/functions/v1/get-called-callback',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-callback-webhook-secret', 'joz-callback-secret-2026-07-13'
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW)
    )
  )
  INTO request_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS joz_callback_requests_email_trigger ON public.joz_callback_requests;

CREATE TRIGGER joz_callback_requests_email_trigger
AFTER INSERT ON public.joz_callback_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_callback_email();
