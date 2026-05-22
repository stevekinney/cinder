---
'cinder': minor
---

New first-party Shiki adapter at `cinder/highlighters/shiki`. Pair it with `<CinderProvider>` for syntax highlighting with one import — no manual `codeToHtml` wrapper required.

```svelte
<script lang="ts">
  import { CinderProvider } from 'cinder';
  import { shikiHighlighter } from 'cinder/highlighters/shiki';

  const highlighter = shikiHighlighter();
</script>

<CinderProvider {highlighter}>
  <!-- the rest of your app -->
</CinderProvider>
```

**Options:**

- `theme?: string | { light: string; dark: string }` — single theme string, or the dual-theme object form that emits CSS variables for `light-dark()`-driven theming. Defaults to `{ light: 'github-light', dark: 'github-dark' }`.
- `langs?: readonly string[]` — languages to preload at first highlight (otherwise Shiki resolves on demand).

**Fallback contract:** empty, missing, or unknown languages render as escaped plaintext wrapped in `<pre><code>` (no throw, warns once per language). Internal Shiki errors are caught and produce the same fallback. The plaintext path HTML-escapes its input so `{@html}` injection stays safe.

**Bundle impact:** Shiki is dynamic-imported on the first highlight call inside the factory's returned function. Consumers who never import `cinder/highlighters/shiki` ship zero Shiki bytes in their entry chunk; consumers who do ship a lazy chunk that loads when the first `<CodeBlock>` highlights.
