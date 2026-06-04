---
'@lostgradient/cinder': major
---

**Breaking: `<CinderProvider>` is removed; `<CodeBlock>` highlights automatically.**

`<CinderProvider>` and `CinderProviderProps`, plus the `cinder/cinder-provider`,
`cinder/cinder-provider/schema`, and `cinder/cinder-provider/variables` subpath
exports, are gone. `<CodeBlock>` now highlights itself: set a `language` and it
lazy-loads the bundled `cinder/highlighters/shiki` adapter on the client and
highlights with no provider and no wiring. Highlighting is a two-phase,
client-only enhancement — the server emits the plain `<pre><code>` fallback and
the client swaps in highlighted HTML once Shiki resolves.

Trade-off: the provider's one capability — scoping a single custom (non-Shiki)
highlighter to a whole subtree — is gone. The common case (Shiki, default
theme) now requires zero configuration; a custom highlighter is passed
per-instance via the new `highlighter` prop instead.

**Migration:**

```svelte
<!-- before -->
<script lang="ts">
  import { CinderProvider, CodeBlock } from 'cinder';
  import { shikiHighlighter } from 'cinder/highlighters/shiki';

  const highlighter = shikiHighlighter();
</script>

<CinderProvider {highlighter}>
  <CodeBlock {code} language="ts" />
</CinderProvider>
```

```svelte
<!-- after: the common case needs nothing — CodeBlock auto-loads Shiki -->
<script lang="ts">
  import { CodeBlock } from 'cinder';
</script>

<CodeBlock {code} language="ts" />
```

```svelte
<!-- after: a custom highlighter is now per-instance via the `highlighter` prop -->
<script lang="ts">
  import { CodeBlock } from 'cinder';
  import { shikiHighlighter } from 'cinder/highlighters/shiki';

  const highlighter = shikiHighlighter({ theme: 'github-light' });
</script>

<CodeBlock {code} language="ts" {highlighter} />
```

New `<CodeBlock>` props:

- `highlighter?: Highlighter` — a custom highlighter for this instance, used in
  place of the bundled default. Its output is rendered **verbatim via `{@html}`**
  and must escape any user-provided `code` (cinder only guarantees the bundled
  Shiki default's output is escaped).
- `highlight?: boolean` — defaults to `true` whenever `language` is set.
  `highlight={false}` is an absolute off switch: it disables all highlighting
  (including an explicit `highlighter`), triggers no Shiki import, and renders
  the escaped plain `<pre><code>` fallback while keeping the `language` label.

**Rollback:** this ships as a single atomic commit (deletion + CodeBlock change

- docs + generated artifacts), so reverting that one commit restores the
  previous state in full.
