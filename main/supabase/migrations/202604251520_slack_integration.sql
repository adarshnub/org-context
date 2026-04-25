alter table public.chat_messages
  add column if not exists source text not null default 'app',
  add column if not exists external_author_name text,
  add column if not exists external_metadata jsonb not null default '{}'::jsonb;

alter table public.workspaces
  alter column enabled_tools set default '["math.calculate", "web.fetchPage", "slack.listChannels", "slack.searchSyncedMessages", "slack.fetchThread", "slack.getPermalink", "slack.sendMessage"]'::jsonb;

update public.workspaces
set enabled_tools = (
  select jsonb_agg(distinct tool)
  from jsonb_array_elements_text(
    enabled_tools || '["slack.listChannels", "slack.searchSyncedMessages", "slack.fetchThread", "slack.getPermalink", "slack.sendMessage"]'::jsonb
  ) as tool
);

create table if not exists public.slack_installations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slack_team_id text not null,
  slack_team_name text not null,
  bot_user_id text,
  bot_access_token_encrypted text not null,
  connected_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id),
  unique (slack_team_id, workspace_id)
);

create table if not exists public.slack_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slack_installation_id uuid not null references public.slack_installations(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete set null,
  slack_channel_id text not null,
  slack_channel_name text not null,
  is_private boolean not null default false,
  is_selected boolean not null default false,
  include_in_context boolean not null default true,
  backfill_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slack_channel_id)
);

create table if not exists public.slack_events (
  slack_event_id text primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  slack_team_id text,
  event_type text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.slack_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slack_channel_id uuid references public.slack_channels(id) on delete set null,
  chat_message_id uuid references public.chat_messages(id) on delete cascade,
  slack_team_id text not null,
  slack_channel_external_id text not null,
  slack_message_ts text not null,
  slack_thread_ts text,
  slack_user_id text,
  permalink text,
  created_at timestamptz not null default now(),
  unique (slack_team_id, slack_channel_external_id, slack_message_ts)
);

create table if not exists public.slack_backfill_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slack_channel_id uuid not null references public.slack_channels(id) on delete cascade,
  status text not null default 'pending',
  next_cursor text,
  latest_ts text,
  imported_count integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slack_channel_id)
);

create index if not exists slack_channels_workspace_selected_idx
  on public.slack_channels (workspace_id, is_selected);

create index if not exists slack_messages_workspace_channel_idx
  on public.slack_messages (workspace_id, slack_channel_external_id);

create or replace function public.match_workspace_chat_messages(
  workspace_id_input uuid,
  channel_ids_input uuid[],
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
  sender jsonb,
  source text,
  external_author_name text,
  external_metadata jsonb
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
    jsonb_build_object('full_name', p.full_name) as sender,
    m.source,
    m.external_author_name,
    m.external_metadata
  from public.chat_message_embeddings e
  join public.chat_messages m on m.id = e.message_id
  left join public.profiles p on p.id = m.sender_id
  where e.workspace_id = workspace_id_input
    and e.channel_id = any(channel_ids_input)
    and m.message_type::text = any(accepted_message_types)
    and (exclude_message_id_input is null or m.id <> exclude_message_id_input)
  order by e.embedding <=> query_embedding, m.created_at desc
  limit greatest(match_count, 1);
$$;

drop trigger if exists slack_installations_set_updated_at on public.slack_installations;
create trigger slack_installations_set_updated_at
before update on public.slack_installations
for each row
execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists slack_channels_set_updated_at on public.slack_channels;
create trigger slack_channels_set_updated_at
before update on public.slack_channels
for each row
execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists slack_backfill_jobs_set_updated_at on public.slack_backfill_jobs;
create trigger slack_backfill_jobs_set_updated_at
before update on public.slack_backfill_jobs
for each row
execute procedure public.set_current_timestamp_updated_at();

alter table public.slack_installations enable row level security;
alter table public.slack_channels enable row level security;
alter table public.slack_events enable row level security;
alter table public.slack_messages enable row level security;
alter table public.slack_backfill_jobs enable row level security;

drop policy if exists "slack_installations_select_member" on public.slack_installations;
create policy "slack_installations_select_member"
  on public.slack_installations
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "slack_channels_select_member" on public.slack_channels;
create policy "slack_channels_select_member"
  on public.slack_channels
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "slack_messages_select_member" on public.slack_messages;
create policy "slack_messages_select_member"
  on public.slack_messages
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "slack_backfill_jobs_select_member" on public.slack_backfill_jobs;
create policy "slack_backfill_jobs_select_member"
  on public.slack_backfill_jobs
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));
