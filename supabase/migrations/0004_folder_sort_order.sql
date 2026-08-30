-- Atria — Tabs and sub-tabs become manually reorderable, mirroring the
-- fractional sort_order pattern already used for blocks.

alter table public.folders add column sort_order double precision not null default 0;

update public.folders
set sort_order = extract(epoch from created_at);

create index folders_sort_order_idx on public.folders (project_id, parent_folder_id, sort_order);
