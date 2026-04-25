-- Run this after deploying the `embed-chat-message` Edge Function.
--
-- Replace the placeholders before executing:
--   YOUR_PROJECT_REF: the Supabase project ref, for example abcdefghijklmnop
--   YOUR_SUPABASE_ANON_KEY: the project's anon/public key
--
-- This version uses pg_net directly instead of supabase_functions.http_request,
-- because some Supabase projects do not have the `supabase_functions` schema.

create extension if not exists pg_net;

create or replace function public.invoke_embed_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
begin
  perform net.http_post(
    url := 'https://mplhdgoddipbtujpjqgt.supabase.co/functions/v1/embed-chat-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbGhkZ29kZGlwYnR1anBqcWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwOTI0MTgsImV4cCI6MjA5MjY2ODQxOH0.fxKKvgAAzv01UPuDvpmB0e4HL3ngL_QVnrNatEiTUXg'
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(new),
      'old_record', null
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

drop trigger if exists embed_chat_message_webhook on public.chat_messages;

create trigger embed_chat_message_webhook
after insert on public.chat_messages
for each row
when (
  new.embedding_status = 'pending'
  and new.message_type in ('user', 'command', 'assistant')
)
execute function public.invoke_embed_chat_message();

-- Debug recent webhook deliveries after inserting a chat message.
select *
from net._http_response
order by created desc
limit 20;
