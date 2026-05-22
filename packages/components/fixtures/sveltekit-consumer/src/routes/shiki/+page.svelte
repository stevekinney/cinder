<script lang="ts">
  // PR 3 publish-path probe: the first-party `cinder/highlighters/shiki`
  // adapter must resolve through the published tarball under Vite + the
  // Svelte plugin (the realistic consumer toolchain). One factory call +
  // one highlighted CodeBlock is enough to prove the resolution chain.
  import { CinderProvider, CodeBlock } from 'cinder';
  import { shikiHighlighter } from 'cinder/highlighters/shiki';

  const highlighter = shikiHighlighter();
  const code = `const greeting: string = 'hello from the publish-path probe';`;
</script>

<main>
  <h1>cinder/highlighters/shiki — bundled adapter resolves through the tarball</h1>
  <CinderProvider {highlighter}>
    <CodeBlock {code} language="ts" />
  </CinderProvider>
</main>
