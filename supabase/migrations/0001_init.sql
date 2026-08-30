-- Atria — Phase 1 schema
-- Hierarchy: auth.users -> public.users -> projects -> folders/files
-- Photos/Videos/Documents are smart views over files.mime_type, not physical folders.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  name text not null,
  description text,
  cover_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_id_idx on public.projects (user_id);

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  parent_folder_id uuid references public.folders (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index folders_project_id_idx on public.folders (project_id);
create index folders_parent_folder_id_idx on public.folders (parent_folder_id);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_key text not null unique,
  thumbnail_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index files_project_id_idx on public.files (project_id);
create index files_folder_id_idx on public.files (folder_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger folders_set_updated_at
  before update on public.folders
  for each row execute function public.set_updated_at();

create trigger files_set_updated_at
  before update on public.files
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Project-boundary triggers
-- A folder's parent, and a file's folder, must belong to the same project.
-- ---------------------------------------------------------------------------

create function public.check_folder_parent_project()
returns trigger
language plpgsql
as $$
begin
  if new.parent_folder_id is not null then
    if not exists (
      select 1 from public.folders
      where id = new.parent_folder_id
        and project_id = new.project_id
    ) then
      raise exception 'parent_folder_id must belong to the same project';
    end if;
  end if;
  return new;
end;
$$;

create trigger folders_check_parent_project
  before insert or update on public.folders
  for each row execute function public.check_folder_parent_project();

create function public.check_file_folder_project()
returns trigger
language plpgsql
as $$
begin
  if new.folder_id is not null then
    if not exists (
      select 1 from public.folders
      where id = new.folder_id
        and project_id = new.project_id
    ) then
      raise exception 'folder_id must belong to the same project';
    end if;
  end if;
  return new;
end;
$$;

create trigger files_check_folder_project
  before insert or update on public.files
  for each row execute function public.check_file_folder_project();

-- ---------------------------------------------------------------------------
-- New-user provisioning: mirror auth.users into public.users on signup
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.folders enable row level security;
alter table public.files enable row level security;

create policy "users can view own row"
  on public.users for select
  using (id = auth.uid());

create policy "users can update own row"
  on public.users for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "users can view own projects"
  on public.projects for select
  using (user_id = auth.uid());

create policy "users can insert own projects"
  on public.projects for insert
  with check (user_id = auth.uid());

create policy "users can update own projects"
  on public.projects for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users can delete own projects"
  on public.projects for delete
  using (user_id = auth.uid());

create policy "users can view own folders"
  on public.folders for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = folders.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "users can insert own folders"
  on public.folders for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = folders.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "users can update own folders"
  on public.folders for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = folders.project_id
        and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = folders.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "users can delete own folders"
  on public.folders for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = folders.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "users can view own files"
  on public.files for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = files.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "users can insert own files"
  on public.files for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = files.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "users can update own files"
  on public.files for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = files.project_id
        and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = files.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "users can delete own files"
  on public.files for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = files.project_id
        and projects.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: private bucket for project files
-- Path convention: {user_id}/{project_id}/{file_id}-{filename}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false);

create policy "users can read own storage objects"
  on storage.objects for select
  using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can upload own storage objects"
  on storage.objects for insert
  with check (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can update own storage objects"
  on storage.objects for update
  using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete own storage objects"
  on storage.objects for delete
  using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
