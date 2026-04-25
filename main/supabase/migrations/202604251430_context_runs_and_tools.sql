alter table public.workspaces
  add column if not exists enabled_tools jsonb not null default '["math.calculate", "web.fetchPage"]'::jsonb;

create table if not exists public.chat_context_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  command_message_id uuid references public.chat_messages(id) on delete set null,
  assistant_message_id uuid references public.chat_messages(id) on delete set null,
  question text not null,
  answer text,
  answer_provider public.answer_provider not null,
  model text,
  system_prompt text,
  model_input text,
  rag_snippets jsonb not null default '[]'::jsonb,
  recent_messages jsonb not null default '[]'::jsonb,
  enabled_tools jsonb not null default '[]'::jsonb,
  tool_calls jsonb not null default '[]'::jsonb,
  token_breakdown jsonb not null default '[]'::jsonb,
  input_tokens integer,
  output_tokens integer,
  token_source text not null default 'estimated',
  status text not null default 'running',
  error text,
  created_at timestamptz not null default now()
);

create index if not exists chat_context_runs_workspace_channel_created_idx
  on public.chat_context_runs (workspace_id, channel_id, created_at desc);

create index if not exists chat_context_runs_command_message_idx
  on public.chat_context_runs (command_message_id);

create or replace function public.match_chat_messages(
  workspace_id_input uuid,
  channel_id_input uuid,
  query_embedding vector(1536),
  match_count int default 8,
  accepted_message_types text[] default array['user'],
  exclude_message_id_input uuid default null
)
returns table (
  id uuid,
  workspace_id uuid,
  channel_id uuid,
  sender_id uuid,
  message_type public.message_type,
  body text,
  created_at timestamptz,
  similarity double precision,
  sender jsonb
)
language sql
stable
as $$
  select
    m.id,
    m.workspace_id,
    m.channel_id,
    m.sender_id,
    m.message_type,
    m.body,
    m.created_at,
    1 - (e.embedding <=> query_embedding) as similarity,
    jsonb_build_object('full_name', p.full_name) as sender
  from public.chat_message_embeddings e
  join public.chat_messages m on m.id = e.message_id
  left join public.profiles p on p.id = m.sender_id
  where e.workspace_id = workspace_id_input
    and e.channel_id = channel_id_input
    and m.message_type::text = any(accepted_message_types)
    and (exclude_message_id_input is null or m.id <> exclude_message_id_input)
  order by e.embedding <=> query_embedding, m.created_at desc
  limit greatest(match_count, 1);
$$;

alter table public.chat_context_runs enable row level security;

drop policy if exists "chat_context_runs_select_member" on public.chat_context_runs;
create policy "chat_context_runs_select_member"
  on public.chat_context_runs
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));
