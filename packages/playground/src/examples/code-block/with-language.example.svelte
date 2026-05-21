<script lang="ts" module>
  export const title = 'With language label and copy';
  export const description =
    'Header shows the language and a copy-to-clipboard button. Syntax highlighting comes from a CinderProvider at the page root — examples never wire a per-instance highlighter.';
</script>

<script lang="ts">
  import { codeToHtml } from 'shiki';
  import { CinderProvider, CodeBlock } from 'cinder';
  import type { Highlighter } from 'cinder';

  const code = `SELECT id, name, created_at
FROM users
WHERE active = true
ORDER BY created_at DESC
LIMIT 10;`;

  // Realistic app shape: mount one provider near the root and let every
  // descendant CodeBlock pick the highlighter up via context. Production
  // apps would do this once at the layout level — this example inlines it
  // only because each .example.svelte renders in isolation.
  const highlighter: Highlighter = async (source, lang) =>
    codeToHtml(source, { lang, theme: 'github-light' });
</script>

<CinderProvider {highlighter}>
  <CodeBlock {code} language="sql" copyable />
</CinderProvider>
