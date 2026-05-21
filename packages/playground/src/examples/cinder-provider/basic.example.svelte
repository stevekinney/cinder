<script lang="ts" module>
  export const title = 'Mount one provider at the root';
  export const description =
    'Wrap your app root with <CinderProvider highlighter={shikiHighlighter()}> once. The bundled cinder/highlighters/shiki adapter is the recommended default — every descendant <CodeBlock> picks it up via context.';
</script>

<script lang="ts">
  import { CinderProvider, CodeBlock } from 'cinder';
  import { shikiHighlighter } from 'cinder/highlighters/shiki';

  const highlighter = shikiHighlighter();

  const tsCode = `function greet(name: string): string {
  return \`Hello, \${name}!\`;
}`;

  const sqlCode = `SELECT count(*) FROM users WHERE active = true;`;
</script>

<CinderProvider {highlighter}>
  <CodeBlock code={tsCode} language="ts" copyable />
  <CodeBlock code={sqlCode} language="sql" />
</CinderProvider>
