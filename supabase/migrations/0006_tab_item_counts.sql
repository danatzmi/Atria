-- Atria — count a project's tab contents in the database instead of in Node.
--
-- The previous approach selected one column for every folder and every block
-- in the project and counted the rows in application memory. That was wasteful,
-- but the real problem was correctness: PostgREST caps a result set (1000 rows
-- by default), so any project with more than that many blocks silently returned
-- a truncated set and the sidebar's count badges under-reported. Aggregating in
-- SQL returns one row per folder, so the cap is no longer reachable in any
-- realistic binder.
--
-- Returns both numbers the UI needs, in one pass:
--   item_count   — direct children of the folder: sub-tabs AND blocks
--                  (drives the badge next to a tab)
--   subtab_count — sub-tabs only
--                  (drives chevron-vs-dot, which must not count blocks)
--
-- SECURITY INVOKER (the default, stated explicitly): the function runs as the
-- calling user, so the existing RLS policies on folders/blocks still apply and
-- a caller can only ever count rows inside their own project. It must NOT be
-- security definer — that would bypass RLS and let any signed-in user count
-- another workspace's contents.
create function public.tab_item_counts(p_project_id uuid)
returns table (folder_id uuid, item_count bigint, subtab_count bigint)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with subtabs as (
    select parent_folder_id as folder_id, count(*) as n
    from public.folders
    where project_id = p_project_id
      and parent_folder_id is not null
    group by parent_folder_id
  ),
  section_blocks as (
    select section_id as folder_id, count(*) as n
    from public.blocks
    where project_id = p_project_id
      and section_id is not null
    group by section_id
  )
  -- full outer join: a folder may hold only sub-tabs, only blocks, or both.
  select
    coalesce(s.folder_id, b.folder_id) as folder_id,
    coalesce(s.n, 0) + coalesce(b.n, 0) as item_count,
    coalesce(s.n, 0) as subtab_count
  from subtabs s
  full outer join section_blocks b on b.folder_id = s.folder_id;
$$;
