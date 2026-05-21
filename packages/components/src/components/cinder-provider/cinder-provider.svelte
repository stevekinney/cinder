<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status stable
   * @purpose Root-mounted context provider that shares a syntax highlighter with every descendant `<CodeBlock>`.
   * @tag context
   * @tag provider
   * @useWhen Mounting cinder in an app root and wanting every `<CodeBlock>` to share one highlighter (the canonical setup).
   * @useWhen Scoping a different highlighter to a subtree by nesting a second `<CinderProvider>`.
   * @avoidWhen Configuring highlighters per `<CodeBlock>` — the prop was removed in PR 2; the provider IS the API now.
   * @related code-block
   */
  export type { CinderProviderProps } from './cinder-provider.types.ts';
</script>

<script lang="ts">
  import { setContext } from 'svelte';

  import {
    HIGHLIGHTER_CONTEXT_KEY,
    type HighlighterContext,
  } from '../../_internal/highlighter-context.ts';
  import type { CinderProviderProps } from './cinder-provider.types.ts';

  let { highlighter, children }: CinderProviderProps = $props();

  // Reactive context shape mirrors the canonical pattern used by
  // accordion.svelte / tabs.svelte / dropdown.svelte: a getter property that
  // closes over the prop. Svelte 5 closures over `$props()` are not
  // automatically reactive across `setContext` boundaries — the getter
  // bridges that gap so descendants see fresh values whenever the parent
  // reassigns `highlighter`.
  setContext<HighlighterContext>(HIGHLIGHTER_CONTEXT_KEY, {
    get highlighter() {
      return highlighter;
    },
  });
</script>

{@render children()}
