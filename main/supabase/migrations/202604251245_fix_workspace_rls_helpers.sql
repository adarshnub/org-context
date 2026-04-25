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
