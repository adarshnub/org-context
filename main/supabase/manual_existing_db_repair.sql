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

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  using (
    auth.uid() = id
    or public.shares_workspace(id, auth.uid())
  );

drop policy if exists "workspace_members_select_member" on public.workspace_members;
create policy "workspace_members_select_member"
  on public.workspace_members
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member"
  on public.workspaces
  for select
  using (public.is_workspace_member(id, auth.uid()));

drop policy if exists "channels_select_member" on public.channels;
create policy "channels_select_member"
  on public.channels
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "chat_messages_select_member" on public.chat_messages;
create policy "chat_messages_select_member"
  on public.chat_messages
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

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
end
$$;
