create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  status text not null default 'draft' check (status in ('draft', 'processing', 'completed', 'archived')),
  aspect_ratio text not null default '9:16' check (aspect_ratio in ('9:16', '16:9', '1:1')),
  editor_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scenes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 255),
  asset_path text,
  audio_path text,
  asset_size_bytes bigint not null default 0 check (asset_size_bytes >= 0),
  content_type text not null default 'video/mp4',
  duration_seconds numeric(10, 3) not null default 0 check (duration_seconds >= 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  script_text text not null default '',
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scenes drop constraint if exists scenes_project_id_sort_order_key;
alter table public.scenes add column if not exists audio_path text;
alter table public.scenes add column if not exists asset_size_bytes bigint not null default 0;
alter table public.scenes add column if not exists content_type text not null default 'video/mp4';

create index if not exists projects_owner_updated_idx on public.projects (user_id, updated_at desc);
create index if not exists scenes_project_order_idx on public.scenes (project_id, sort_order);

create table if not exists public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  worker_job_id text,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  progress integer not null default 0 check (progress between 0 and 100),
  output_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists render_jobs_owner_created_idx on public.render_jobs (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();
drop trigger if exists scenes_set_updated_at on public.scenes;
create trigger scenes_set_updated_at before update on public.scenes
for each row execute function public.set_updated_at();
drop trigger if exists render_jobs_set_updated_at on public.render_jobs;
create trigger render_jobs_set_updated_at before update on public.render_jobs
for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
alter table public.scenes enable row level security;
alter table public.render_jobs enable row level security;

drop policy if exists "Users manage their projects" on public.projects;
create policy "Users manage their projects" on public.projects
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their scenes" on public.scenes;
create policy "Users manage their scenes" on public.scenes
for all to authenticated using (
  auth.uid() = user_id and exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
  )
) with check (
  auth.uid() = user_id and exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('video-assets', 'video-assets', false, 524288000, array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'audio/mpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users manage own video assets" on storage.objects;
create policy "Users manage own video assets" on storage.objects
for all to authenticated using (
  bucket_id = 'video-assets' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'video-assets' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users view their render jobs" on public.render_jobs;
create policy "Users view their render jobs" on public.render_jobs
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users create their render jobs" on public.render_jobs;
create policy "Users create their render jobs" on public.render_jobs
for insert to authenticated with check (
  auth.uid() = user_id and exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
  )
);
drop policy if exists "Users update their render jobs" on public.render_jobs;
create policy "Users update their render jobs" on public.render_jobs
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);