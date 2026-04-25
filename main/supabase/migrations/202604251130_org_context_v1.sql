create extension if not exists vector;

do $$
begin
  create type public.answer_provider as enum ('cohere', 'openai');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.workspace_role as enum ('owner', 'member');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.invite_status as enum ('pending', 'accepted', 'declined');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.message_type as enum ('user', 'command', 'assistant', 'system');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.embedding_status as enum ('pending', 'completed', 'failed');
exception
  when duplicate_object then null;
end
$$;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  company_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  answer_provider public.answer_provider not null default 'cohere',
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invited_email text not null,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  status public.invite_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create unique index if not exists workspace_invites_pending_idx
  on public.workspace_invites (workspace_id, invited_user_id)
  where status = 'pending';

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  message_type public.message_type not null,
  body text not null,
  command_name text,
  citations jsonb not null default '[]'::jsonb,
  embedding_status public.embedding_status not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.chat_messages replica identity full;

create table if not exists public.chat_message_embeddings (
  message_id uuid primary key references public.chat_messages(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  provider text not null default 'cohere',
  model text not null default 'embed-v4.0',
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create index if not exists workspace_members_user_id_idx
  on public.workspace_members (user_id);

create index if not exists workspace_members_workspace_id_idx
  on public.workspace_members (workspace_id);

create index if not exists workspace_invites_invited_user_status_idx
  on public.workspace_invites (invited_user_id, status);

create index if not exists channels_workspace_id_idx
  on public.channels (workspace_id);

create index if not exists chat_messages_workspace_channel_created_idx
  on public.chat_messages (workspace_id, channel_id, created_at desc);

create index if not exists chat_messages_sender_id_created_idx
  on public.chat_messages (sender_id, created_at desc);

create index if not exists chat_message_embeddings_workspace_channel_idx
  on public.chat_message_embeddings (workspace_id, channel_id);

create index if not exists chat_message_embeddings_vector_idx
  on public.chat_message_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute procedure public.set_current_timestamp_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, company_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data->>'company_name', 'Unknown company')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    company_name = excluded.company_name;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update on auth.users
for each row
execute procedure public.handle_new_user();

create or replace function public.is_workspace_member(workspace_uuid uuid, user_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = workspace_uuid
      and user_id = user_uuid
  );
$$;

create or replace function public.is_workspace_owner(workspace_uuid uuid, user_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = workspace_uuid
      and user_id = user_uuid
      and role = 'owner'
  );
$$;

create or replace function public.shares_workspace(profile_uuid uuid, user_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members profile_membership
    join public.workspace_members current_user_membership
      on current_user_membership.workspace_id = profile_membership.workspace_id
    where profile_membership.user_id = profile_uuid
      and current_user_membership.user_id = user_uuid
  );
$$;

create or replace function public.match_chat_messages(
  workspace_id_input uuid,
  channel_id_input uuid,
  query_embedding vector(1536),
  match_count int default 8
)
returns table (
  id uuid,
  workspace_id uuid,
  channel_id uuid,
  sender_id uuid,
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
    m.body,
    m.created_at,
    1 - (e.embedding <=> query_embedding) as similarity,
    jsonb_build_object('full_name', p.full_name) as sender
  from public.chat_message_embeddings e
  join public.chat_messages m on m.id = e.message_id
  left join public.profiles p on p.id = m.sender_id
  where e.workspace_id = workspace_id_input
    and e.channel_id = channel_id_input
  order by e.embedding <=> query_embedding, m.created_at desc
  limit greatest(match_count, 1);
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.channels enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_message_embeddings enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  using (
    auth.uid() = id
    or public.shares_workspace(id, auth.uid())
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member"
  on public.workspaces
  for select
  using (public.is_workspace_member(id, auth.uid()));

drop policy if exists "workspaces_insert_owner" on public.workspaces;
create policy "workspaces_insert_owner"
  on public.workspaces
  for insert
  with check (auth.uid() = owner_id);

drop policy if exists "workspaces_update_owner" on public.workspaces;
create policy "workspaces_update_owner"
  on public.workspaces
  for update
  using (public.is_workspace_owner(id, auth.uid()))
  with check (public.is_workspace_owner(id, auth.uid()));

drop policy if exists "workspace_members_select_member" on public.workspace_members;
create policy "workspace_members_select_member"
  on public.workspace_members
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "workspace_members_insert_self_or_owner" on public.workspace_members;
create policy "workspace_members_insert_self_or_owner"
  on public.workspace_members
  for insert
  with check (
    auth.uid() = user_id
    or public.is_workspace_owner(workspace_id, auth.uid())
  );

drop policy if exists "workspace_invites_select_self_or_owner" on public.workspace_invites;
create policy "workspace_invites_select_self_or_owner"
  on public.workspace_invites
  for select
  using (
    invited_user_id = auth.uid()
    or public.is_workspace_owner(workspace_id, auth.uid())
  );

drop policy if exists "workspace_invites_insert_owner" on public.workspace_invites;
create policy "workspace_invites_insert_owner"
  on public.workspace_invites
  for insert
  with check (public.is_workspace_owner(workspace_id, auth.uid()));

drop policy if exists "workspace_invites_update_self_or_owner" on public.workspace_invites;
create policy "workspace_invites_update_self_or_owner"
  on public.workspace_invites
  for update
  using (
    invited_user_id = auth.uid()
    or public.is_workspace_owner(workspace_id, auth.uid())
  )
  with check (
    invited_user_id = auth.uid()
    or public.is_workspace_owner(workspace_id, auth.uid())
  );

drop policy if exists "channels_select_member" on public.channels;
create policy "channels_select_member"
  on public.channels
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "channels_insert_owner" on public.channels;
create policy "channels_insert_owner"
  on public.channels
  for insert
  with check (public.is_workspace_owner(workspace_id, auth.uid()));

drop policy if exists "chat_messages_select_member" on public.chat_messages;
create policy "chat_messages_select_member"
  on public.chat_messages
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "chat_messages_insert_user_or_command" on public.chat_messages;
create policy "chat_messages_insert_user_or_command"
  on public.chat_messages
  for insert
  with check (
    public.is_workspace_member(workspace_id, auth.uid())
    and sender_id = auth.uid()
    and message_type in ('user', 'command')
  );

drop policy if exists "chat_message_embeddings_select_member" on public.chat_message_embeddings;
create policy "chat_message_embeddings_select_member"
  on public.chat_message_embeddings
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;
