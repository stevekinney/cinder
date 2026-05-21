<script lang="ts" module>
  export const title = 'Nested provider overrides the root';
  export const description =
    'Mount a second <CinderProvider> deeper in the tree to use a different highlighter for a subtree. The nearest provider wins. Useful for previewing a different theme or grammar set without touching the rest of the app.';
</script>

<script lang="ts">
  import { CinderProvider, CodeBlock } from 'cinder';
  import { shikiHighlighter } from 'cinder/highlighters/shiki';

  const lightHighlighter = shikiHighlighter({ theme: 'github-light' });
  const darkHighlighter = shikiHighlighter({ theme: 'github-dark' });

  const code = `function greet(name: string): string {
  return \`Hello, \${name}!\`;
}`;
</script>

<CinderProvider highlighter={lightHighlighter}>
  <p class="example-preview-row" style:display="block">
    <strong>Outer provider (github-light):</strong>
  </p>
  <CodeBlock {code} language="ts" />

  <CinderProvider highlighter={darkHighlighter}>
    <p class="example-preview-row" style:display="block">
      <strong>Inner provider (github-dark) — nearest wins:</strong>
    </p>
    <CodeBlock {code} language="ts" />
  </CinderProvider>
</CinderProvider>
