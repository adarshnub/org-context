do $$
begin
  create type public.repository_sync_trigger as enum ('manual', 'hourly', 'continuation');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.repository_sync_status as enum ('pending', 'running', 'completed', 'failed', 'partial');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.workspace_repositories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  repo_url text not null,
  github_owner text not null,
  github_repo text not null,
  branch text not null default 'main',
  encrypted_access_token text,
  sync_hourly boolean not null default true,
  sync_status public.repository_sync_status not null default 'pending',
  last_indexed_commit_sha text,
  last_synced_at timestamptz,
  last_sync_job_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, github_owner, github_repo, branch)
);

create table if not exists public.repository_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.workspace_repositories(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  trigger_type public.repository_sync_trigger not null,
  status public.repository_sync_status not null default 'pending',
  attempt_count integer not null default 0,
  logs jsonb not null default '[]'::jsonb,
  cursor jsonb not null default '{}'::jsonb,
  processed_file_count integer not null default 0,
  skipped_file_count integer not null default 0,
  chunk_count integer not null default 0,
  target_commit_sha text,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

do $$
begin
  alter table public.workspace_repositories
    add constraint workspace_repositories_last_sync_job_fkey
    foreign key (last_sync_job_id)
    references public.repository_sync_jobs(id)
    on delete set null
    not valid;

  alter table public.workspace_repositories
    validate constraint workspace_repositories_last_sync_job_fkey;
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.repository_files (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.workspace_repositories(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  path text not null,
  blob_sha text not null,
  size integer not null default 0,
  language text,
  indexed_commit_sha text not null,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (repository_id, path)
);

create table if not exists public.repository_code_chunks (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.repository_files(id) on delete cascade,
  repository_id uuid not null references public.workspace_repositories(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  chunk_index integer not null,
  path text not null,
  start_line integer not null,
  end_line integer not null,
  content_hash text not null,
  content text not null,
  content_preview text not null,
  created_at timestamptz not null default now(),
  unique (file_id, chunk_index)
);

create table if not exists public.repository_code_embeddings (
  chunk_id uuid primary key references public.repository_code_chunks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  repository_id uuid not null references public.workspace_repositories(id) on delete cascade,
  provider text not null default 'cohere',
  model text not null default 'embed-v4.0',
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

alter table public.chat_context_runs
  add column if not exists repository_snippets jsonb not null default '[]'::jsonb;

create index if not exists workspace_repositories_workspace_idx
  on public.workspace_repositories (workspace_id);

create index if not exists repository_sync_jobs_repo_status_created_idx
  on public.repository_sync_jobs (repository_id, status, created_at desc);

create index if not exists repository_sync_jobs_pending_idx
  on public.repository_sync_jobs (status, created_at)
  where status = 'pending';

create index if not exists repository_files_repo_path_idx
  on public.repository_files (repository_id, path);

create index if not exists repository_code_chunks_repo_path_idx
  on public.repository_code_chunks (repository_id, path);

create index if not exists repository_code_embeddings_workspace_repo_idx
  on public.repository_code_embeddings (workspace_id, repository_id);

create index if not exists repository_code_embeddings_vector_idx
  on public.repository_code_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

drop trigger if exists workspace_repositories_set_updated_at on public.workspace_repositories;
create trigger workspace_repositories_set_updated_at
before update on public.workspace_repositories
for each row
execute procedure public.set_current_timestamp_updated_at();

create or replace function public.claim_next_repository_sync_job()
returns table (
  id uuid,
  repository_id uuid,
  workspace_id uuid,
  trigger_type public.repository_sync_trigger
)
language plpgsql
security definer
set search_path = public
as $$
declare
  job_id uuid;
begin
  select j.id into job_id
  from public.repository_sync_jobs j
  where j.status = 'pending'
  order by j.created_at
  for update skip locked
  limit 1;

  if job_id is null then
    return;
  end if;

  update public.repository_sync_jobs j
  set
    status = 'running',
    started_at = now(),
    attempt_count = j.attempt_count + 1
  where j.id = job_id;

  return query
  select j.id, j.repository_id, j.workspace_id, j.trigger_type
  from public.repository_sync_jobs j
  where j.id = job_id;
end;
$$;

create or replace function public.match_repository_code_chunks(
  workspace_id_input uuid,
  query_embedding vector(1536),
  match_count int default 8
)
returns table (
  chunk_id uuid,
  repository_id uuid,
  repo_url text,
  github_owner text,
  github_repo text,
  branch text,
  path text,
  start_line integer,
  end_line integer,
  content text,
  content_preview text,
  commit_sha text,
  similarity double precision
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    r.id as repository_id,
    r.repo_url,
    r.github_owner,
    r.github_repo,
    r.branch,
    c.path,
    c.start_line,
    c.end_line,
    c.content,
    c.content_preview,
    f.indexed_commit_sha as commit_sha,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.repository_code_embeddings e
  join public.repository_code_chunks c on c.id = e.chunk_id
  join public.repository_files f on f.id = c.file_id
  join public.workspace_repositories r on r.id = c.repository_id
  where e.workspace_id = workspace_id_input
    and f.deleted_at is null
  order by e.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

alter table public.workspace_repositories enable row level security;
alter table public.repository_sync_jobs enable row level security;
alter table public.repository_files enable row level security;
alter table public.repository_code_chunks enable row level security;
alter table public.repository_code_embeddings enable row level security;

drop policy if exists "workspace_repositories_select_member" on public.workspace_repositories;
create policy "workspace_repositories_select_member"
  on public.workspace_repositories
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "workspace_repositories_insert_owner" on public.workspace_repositories;
create policy "workspace_repositories_insert_owner"
  on public.workspace_repositories
  for insert
  with check (public.is_workspace_owner(workspace_id, auth.uid()));

drop policy if exists "workspace_repositories_update_owner" on public.workspace_repositories;
create policy "workspace_repositories_update_owner"
  on public.workspace_repositories
  for update
  using (public.is_workspace_owner(workspace_id, auth.uid()))
  with check (public.is_workspace_owner(workspace_id, auth.uid()));

drop policy if exists "workspace_repositories_delete_owner" on public.workspace_repositories;
create policy "workspace_repositories_delete_owner"
  on public.workspace_repositories
  for delete
  using (public.is_workspace_owner(workspace_id, auth.uid()));

drop policy if exists "repository_sync_jobs_select_member" on public.repository_sync_jobs;
create policy "repository_sync_jobs_select_member"
  on public.repository_sync_jobs
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "repository_sync_jobs_insert_owner" on public.repository_sync_jobs;
create policy "repository_sync_jobs_insert_owner"
  on public.repository_sync_jobs
  for insert
  with check (public.is_workspace_owner(workspace_id, auth.uid()));

drop policy if exists "repository_files_select_member" on public.repository_files;
create policy "repository_files_select_member"
  on public.repository_files
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "repository_code_chunks_select_member" on public.repository_code_chunks;
create policy "repository_code_chunks_select_member"
  on public.repository_code_chunks
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "repository_code_embeddings_select_member" on public.repository_code_embeddings;
create policy "repository_code_embeddings_select_member"
  on public.repository_code_embeddings
  for select
  using (public.is_workspace_member(workspace_id, auth.uid()));
