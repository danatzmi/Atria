-- Atria — Block-based notebook stream
-- Sections (folders) now hold an ordered stream of blocks — heading, text,
-- image, file, video — instead of files being grouped by mime type on the
-- fly. section_id is nullable (unlike files.folder_id's own convention,
-- which this mirrors): null means the project root, i.e. the virtual
-- "Unsorted" tab, so every section — real or virtual — gets the same
-- block-stream UI instead of a special-cased fallback.

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  section_id uuid references public.folders (id) on delete cascade,
  type text not null check (type in ('heading', 'text', 'image', 'file', 'video')),
  content text,
  file_id uuid references public.files (id) on delete cascade,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index blocks_section_id_idx on public.blocks (project_id, section_id, sort_order);
create index blocks_file_id_idx on public.blocks (file_id);

create trigger blocks_set_updated_at
  before update on public.blocks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Project-boundary trigger, mirroring check_file_folder_project: a block's
-- section must belong to the same project as the block itself.
-- ---------------------------------------------------------------------------

create function public.check_block_section_project()
returns trigger
language plpgsql
as $$
begin
  if new.section_id is not null then
    if not exists (
      select 1 from public.folders
      where id = new.section_id
        and project_id = new.project_id
    ) then
      raise exception 'section_id must belong to the same project';
    end if;
  end if;
  return new;
end;
$$;

create trigger blocks_check_section_project
  before insert or update on public.blocks
  for each row execute function public.check_block_section_project();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.blocks enable row level security;

create policy "users can manage own blocks"
  on public.blocks for all
  using (
    exists (
      select 1 from public.projects
      where projects.id = blocks.project_id
        and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = blocks.project_id
        and projects.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Backfill: every existing file becomes a block, so nothing already in a
-- binder disappears behind the new stream. created_at (as epoch seconds)
-- doubles as each row's initial fractional sort_order, preserving upload
-- order without a window function.
-- ---------------------------------------------------------------------------

insert into public.blocks (project_id, section_id, type, file_id, sort_order, created_at)
select
  project_id,
  folder_id,
  case
    when mime_type like 'image/%' then 'image'
    when mime_type like 'video/%' then 'video'
    else 'file'
  end,
  id,
  extract(epoch from created_at),
  created_at
from public.files;
