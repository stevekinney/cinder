<script lang="ts">
  // Publish-path probe (Fixture B): the first-party `cinder/highlighters/shiki`
  // adapter must resolve through the published tarball under Vite + the
  // Svelte plugin (the realistic consumer toolchain). One factory call +
  // one CodeBlock with an explicit `highlighter` prop is enough to prove the
  // public subpath export still resolves. (The auto-load default — no import —
  // is covered by the `auto-highlight` fixture route.)
  import { CodeBlock } from 'cinder';
  import { shikiHighlighter } from 'cinder/highlighters/shiki';

  const highlighter = shikiHighlighter();
  const code = `const greeting: string = 'hello from the publish-path probe';`;
</script>

<main>
  <h1>cinder/highlighters/shiki — bundled adapter resolves through the tarball</h1>
  <CodeBlock {code} language="ts" {highlighter} />
</main>
