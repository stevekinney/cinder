<script lang="ts">
  // Auto-load probe (Fixture A): a `<CodeBlock>` with a `language` and NO
  // highlighter wiring of any kind — no `@lostgradient/cinder/highlighters/shiki` import, no
  // provider. This proves CodeBlock lazy-loads the bundled Shiki default
  // through the published tarball with zero consumer configuration. (The
  // explicit-prop path is covered by the `shiki` fixture route.)
  import { CodeBlock } from '@lostgradient/cinder';

  const code = `const greeting: string = 'hello from the auto-load probe';`;
</script>

<main>
  <h1>CodeBlock auto-highlights from the bundled Shiki default — no wiring</h1>
  <CodeBlock {code} language="ts" />
</main>
