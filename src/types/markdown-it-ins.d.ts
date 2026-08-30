// markdown-it-ins ships no types of its own — a minimal ambient module
// declaration is enough since it's used for its single default export.
declare module "markdown-it-ins" {
  import type MarkdownIt from "markdown-it";

  const plugin: (md: MarkdownIt) => void;
  export default plugin;
}
