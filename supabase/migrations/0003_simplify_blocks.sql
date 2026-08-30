-- Atria — Collapse the standalone "heading" block type. Headings are now
-- just H1 markdown within a text block's content (see the rich-text
-- formatting toolbar), not a separate block type — image/file/video stay as
-- internal rendering variants of one conceptual "File Block."

update public.blocks
set type = 'text', content = '# ' || coalesce(content, '')
where type = 'heading';

alter table public.blocks drop constraint if exists blocks_type_check;
alter table public.blocks add constraint blocks_type_check
  check (type in ('text', 'image', 'file', 'video'));
