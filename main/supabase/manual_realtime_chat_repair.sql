-- Run this in Supabase SQL Editor if chat messages are saving but not appearing
-- live in other browser sessions.

alter table public.chat_messages replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

select
  schemaname,
  tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'chat_messages';
