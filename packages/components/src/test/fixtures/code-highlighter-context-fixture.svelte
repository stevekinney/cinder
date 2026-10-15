<!--
  Publishes `highlighter` through the code-highlighter context, then renders
  `component` with `childProps` beneath it. Tests use it to prove that a
  `<CodeBlock>` with no `highlighter` prop — directly or inside a composite
  such as `ApprovalCard` — highlights with the context highlighter.
-->
<script lang="ts">
  import type { Component } from 'svelte';

  import { setCodeHighlighterContext } from '../../_internal/code-highlighter-context.ts';
  import type { Highlighter } from '../../utilities/highlighter.ts';

  type Props = {
    highlighter: Highlighter;
    /**
     * Any component: `Component<never>` accepts every props shape, and the test
     * pairs it with matching `childProps`.
     */
    component: Component<never>;
    childProps: Record<string, unknown>;
  };

  let { highlighter, component, childProps }: Props = $props();

  const Child = $derived(component as Component<Record<string, unknown>>);

  // Delegate rather than publish the prop value itself, so the context always
  // calls the current `highlighter` prop without reading it during setup.
  setCodeHighlighterContext((code, language) => highlighter(code, language));
</script>

<Child {...childProps} />
