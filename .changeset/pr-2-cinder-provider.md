---
'cinder': major
---

`<CodeBlock>` no longer accepts a `highlighter` prop. Mount `<CinderProvider highlighter={...}>` once near your app root and every descendant `<CodeBlock>` shares the highlighter via Svelte context.

**Migration:**

```svelte
<!-- before -->
<script lang="ts">
  import { codeToHtml } from 'shiki';
  import { CodeBlock } from 'cinder';

  const highlighter = (code, lang) => codeToHtml(code, { lang, theme: 'github-light' });
</script>

<CodeBlock {code} language="ts" {highlighter} />
```

```svelte
<!-- after -->
<script lang="ts">
  import { codeToHtml } from 'shiki';
  import { CinderProvider, CodeBlock } from 'cinder';
  import type { Highlighter } from 'cinder';

  const highlighter: Highlighter = (code, lang) =>
    codeToHtml(code, { lang, theme: 'github-light' });
</script>

<CinderProvider {highlighter}>
  <CodeBlock {code} language="ts" />
</CinderProvider>
```

The provider is reactive: assigning a new `highlighter` after mount re-renders every descendant `<CodeBlock>`. Nest a second `<CinderProvider>` to scope a different highlighter to a subtree (the nearest provider wins). `<CodeBlock>` rendered with no `<CinderProvider>` ancestor falls back to escaped plaintext — the same "no syntax highlighting" state the old prop produced when omitted.

A first-party Shiki adapter ships in PR 3 (`cinder/highlighters/shiki`) so apps that want syntax highlighting out of the box won't need to wire `shiki` themselves.
