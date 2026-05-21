<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Block container for multi-line source code with optional syntax highlighting and a copy-to-clipboard control.
   * @tag code
   * @tag snippet
   * @useWhen Displaying a multi-line code sample or terminal transcript inside documentation or chat.
   * @useWhen Letting the reader copy a snippet to the clipboard via the copyable prop.
   * @avoidWhen Annotating a single inline keystroke or shortcut — use kbd instead.
   * @avoidWhen Rendering rich prose that happens to include code — embed it in markdown instead.
   * @related kbd, copy-button, cinder-provider
   */
  export type { CodeBlockProps } from './code-block.types.ts';
</script>

<script lang="ts">
  import { getHighlighter } from '../../_internal/highlighter-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import CopyButton from '../copy-button/copy-button.svelte';
  import type { CodeBlockProps } from './code-block.types.ts';

  let { code, language, copyable = false, class: className }: CodeBlockProps = $props();

  let highlighted = $state<string | null>(null);

  $effect(() => {
    // Read the highlighter from the nearest `<CinderProvider>` on every
    // run. The provider stores it behind a getter so swapping the prop on
    // a live provider re-runs this effect with the new function.
    const highlighter = getHighlighter();
    if (!language || !highlighter) {
      highlighted = null;
      return;
    }
    // Drop any stale highlighted output before starting a new request so a
    // code/lang/highlighter change can't leave the previous render visible
    // while the new request is in flight.
    highlighted = null;
    let cancelled = false;
    // The highlighter may throw synchronously OR reject. Promise.resolve()
    // alone wouldn't catch a sync throw — wrap in an async IIFE so both
    // failure modes hit the same `.catch`.
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

<div class={classNames('cinder-code-block', className)}>
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
  <!-- `{@html}` reconciliation across string→string transitions strands the
       previous DOM nodes when they're emitted as direct children of an
       `{#if}` branch (Svelte 5: the prior nodes share the same parent and
       no anchor scopes them). Wrap the `{@html}` output in a stable
       container `<div>` so the previous render is contained inside an
       element Svelte can replace in place. -->
  <svelte:boundary>
    {#if highlighted !== null}
      <div class="cinder-code-block__highlighted">{@html highlighted}</div>
    {:else}
      <pre class="cinder-code-block__pre"><code class="cinder-code-block__code">{code}</code></pre>
    {/if}
    {#snippet failed()}
      <pre class="cinder-code-block__pre"><code class="cinder-code-block__code">{code}</code></pre>
    {/snippet}
  </svelte:boundary>
</div>
