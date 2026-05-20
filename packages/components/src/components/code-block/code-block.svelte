<script lang="ts" module>
  export type { CodeBlockProps } from './code-block.types.ts';
</script>

<script lang="ts">
  import type { CodeBlockProps } from './code-block.types.ts';
  import CopyButton from '../copy-button/copy-button.svelte';
  import { cn } from '../../utilities/class-names.ts';

  let {
    code,
    language,
    copyable = false,
    highlighter,
    class: className,
  }: CodeBlockProps = $props();

  let highlighted = $state<string | null>(null);

  $effect(() => {
    if (!language || !highlighter) {
      highlighted = null;
      return;
    }
    // Drop any stale highlighted output before starting a new request so
    // a code/lang change can't leave the previous render visible while the
    // new request is in flight.
    highlighted = null;
    let cancelled = false;
    // The highlighter may throw synchronously OR reject. Promise.resolve()
    // alone wouldn't catch a sync throw — wrap it in an async IIFE so
    // both failure modes hit the same .catch.
    void (async () => {
      try {
        const html = await highlighter(code, language);
        if (!cancelled) highlighted = html === '' ? null : html;
      } catch (error) {
        if (!cancelled) highlighted = null;
        // Surface to the developer without breaking the graceful fallback.
        console.warn('[cinder/CodeBlock] highlighter threw:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  });
</script>

<div class={cn('cinder-code-block', className)}>
  {#if language || copyable}
    <header class="cinder-code-block__header">
      {#if language}
        <span class="cinder-code-block__language">{language}</span>
      {/if}
      {#if copyable}
        <CopyButton
          value={code}
          class="cinder-code-block__copy"
          label="Copy code"
          copiedLabel="Code copied"
          iconOnly={true}
        />
      {/if}
    </header>
  {/if}
  <!-- The svelte:boundary catches errors thrown during render of {@html highlighted}
       (e.g. a malformed HTML string that breaks Svelte's reconciliation). Sync/async
       errors from the highlighter ITSELF are caught above; this is the secondary net. -->
  <svelte:boundary>
    {#if highlighted !== null}
      {@html highlighted}
    {:else}
      <pre class="cinder-code-block__pre"><code class="cinder-code-block__code">{code}</code></pre>
    {/if}
    {#snippet failed()}
      <pre class="cinder-code-block__pre"><code class="cinder-code-block__code">{code}</code></pre>
    {/snippet}
  </svelte:boundary>
</div>
