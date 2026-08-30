-- Atria — per-block typography for text blocks, set via the WYSIWYG editor's
-- Font choice / Size toolbar controls. Whole-block, not per-character: a
-- text block adopts one typeface and one size throughout, matching how the
-- editor's toolbar buttons apply. Both null by default (the existing
-- clean-sans, normal-size look), so every pre-existing block is unaffected.

alter table public.blocks add column font_family text;
alter table public.blocks add column font_size text;

alter table public.blocks add constraint blocks_font_family_check
  check (font_family is null or font_family in ('serif'));

alter table public.blocks add constraint blocks_font_size_check
  check (font_size is null or font_size in ('large'));
