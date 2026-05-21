<script lang="ts" module>
  export const title = 'Mount one provider at the root';
  export const description =
    'Wrap your app root with <CinderProvider highlighter={...}> once. Every descendant <CodeBlock> picks the highlighter up via context — no per-instance prop wiring.';
</script>

<script lang="ts">
  import { codeToHtml } from 'shiki';
  import { CinderProvider, CodeBlock } from 'cinder';
  import type { Highlighter } from 'cinder';

  const highlighter: Highlighter = async (source, lang) =>
    codeToHtml(source, { lang, theme: 'github-light' });

  const tsCode = `function greet(name: string): string {
  return \`Hello, \${name}!\`;
}`;

  const sqlCode = `SELECT count(*) FROM users WHERE active = true;`;
</script>

<CinderProvider {highlighter}>
  <CodeBlock code={tsCode} language="ts" copyable />
  <CodeBlock code={sqlCode} language="sql" />
</CinderProvider>
