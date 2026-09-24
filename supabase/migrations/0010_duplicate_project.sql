-- Atria — clone a project's hierarchy in one round trip.
--
-- Why a database function at all: a full copy is one project row, N folders,
-- M files and K blocks. Done from the app that is 4 + N round trips, every
-- one of them a network hop, and a large binder blows the serverless
-- function's time limit long before it blows the database's. Here it is a
-- handful of set-based statements inside one transaction, so it either
-- fully happens or fully doesn't.
--
-- SECURITY INVOKER, deliberately. The function runs as the caller, so RLS
-- decides what it can see: a project id belonging to someone else simply
-- reads back zero rows and raises below. That is the whole authorization
-- story — no hand-written ownership check to get subtly wrong, and no
-- SECURITY DEFINER escape hatch to audit.
create function public.duplicate_project_hierarchy(
  p_source_project_id uuid,
  -- The new ids are supplied by the caller rather than generated here, and
  -- that is forced by the schema: files.storage_key is UNIQUE, so a copied
  -- file needs a new key, and the key format embeds the project id and the
  -- file id. The app has to know both before it can copy the objects in the
  -- bucket, so it mints them, copies, and then tells us what it used.
  p_new_project_id uuid,
  p_new_name text,
  -- Null for a template copy, which starts coverless.
  p_new_cover_image text,
  p_include_content boolean,
  -- [{"old_id": uuid, "new_id": uuid, "storage_key": text}, ...]
  -- Empty for a template copy.
  p_file_map jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_source public.projects%rowtype;
  v_folder_map jsonb;
begin
  -- RLS makes this the ownership check: not yours, not visible, not found.
  select * into v_source from public.projects where id = p_source_project_id;
  if not found then
    raise exception 'source project not found' using errcode = 'no_data_found';
  end if;

  insert into public.projects (id, name, description, cover_image)
  values (p_new_project_id, p_new_name, v_source.description, p_new_cover_image);

  -- One old id -> new id map for the whole tree, built before anything is
  -- inserted so parent links can be rewritten without a second pass.
  select coalesce(jsonb_object_agg(id::text, gen_random_uuid()::text), '{}'::jsonb)
    into v_folder_map
    from public.folders
   where project_id = p_source_project_id;

  -- The entire folder tree in one statement.
  --
  -- ORDER BY depth is load-bearing, not cosmetic. folders carries a BEFORE
  -- INSERT trigger (check_folder_parent_project) that looks the parent up in
  -- the table, and a BEFORE ROW trigger sees rows inserted earlier in the
  -- same statement — so parents must be produced first. Verified against
  -- this schema: ordering by depth inserts the tree cleanly, and reversing
  -- the order fails with 'parent_folder_id must belong to the same project'.
  -- Delete the ORDER BY and deep trees break while shallow ones keep
  -- working, which is the worst way for this to fail.
  with recursive tree as (
    select f.id, f.parent_folder_id, f.name, f.sort_order, 0 as depth
      from public.folders f
     where f.project_id = p_source_project_id
       and f.parent_folder_id is null
    union all
    select f.id, f.parent_folder_id, f.name, f.sort_order, t.depth + 1
      from public.folders f
      join tree t on f.parent_folder_id = t.id
     where f.project_id = p_source_project_id
  )
  insert into public.folders (id, project_id, parent_folder_id, name, sort_order)
  select
    (v_folder_map ->> t.id::text)::uuid,
    p_new_project_id,
    case
      when t.parent_folder_id is null then null
      else (v_folder_map ->> t.parent_folder_id::text)::uuid
    end,
    t.name,
    t.sort_order
  from tree t
  order by t.depth;

  -- A template copy stops here: structure only, no notes, no files.
  if not p_include_content then
    return p_new_project_id;
  end if;

  -- Files. ids and storage keys come from the caller's map, which is also
  -- what restricts this to objects it actually managed to copy: a file the
  -- app could not duplicate in the bucket is absent from the map, and the
  -- join drops it rather than creating a row pointing at nothing.
  insert into public.files (
    id, project_id, folder_id, name, mime_type, size_bytes, storage_key
  )
  select
    (m ->> 'new_id')::uuid,
    p_new_project_id,
    case
      when f.folder_id is null then null
      else (v_folder_map ->> f.folder_id::text)::uuid
    end,
    f.name,
    f.mime_type,
    f.size_bytes,
    m ->> 'storage_key'
  from jsonb_array_elements(p_file_map) m
  join public.files f on f.id = (m ->> 'old_id')::uuid
  where f.project_id = p_source_project_id;

  -- Blocks last: their section and file both have to exist first.
  --
  -- A block whose file did not make it into the map is skipped entirely
  -- rather than inserted with a null file_id — the stream renders those as
  -- a card with nothing in it, which looks like data loss rather than a
  -- file that was left behind.
  insert into public.blocks (
    id, project_id, section_id, type, content, file_id, sort_order,
    font_family, font_size
  )
  select
    gen_random_uuid(),
    p_new_project_id,
    case
      when b.section_id is null then null
      else (v_folder_map ->> b.section_id::text)::uuid
    end,
    b.type,
    b.content,
    fm.new_id,
    b.sort_order,
    b.font_family,
    b.font_size
  from public.blocks b
  left join (
    select (m ->> 'old_id')::uuid as old_id, (m ->> 'new_id')::uuid as new_id
      from jsonb_array_elements(p_file_map) m
  ) fm on fm.old_id = b.file_id
  where b.project_id = p_source_project_id
    and (b.file_id is null or fm.new_id is not null);

  return p_new_project_id;
end;
$$;

-- PostgREST exposes this to signed-in users; RLS inside still applies.
grant execute on function public.duplicate_project_hierarchy(
  uuid, uuid, text, text, boolean, jsonb
) to authenticated;
