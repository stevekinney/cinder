<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Block container for multi-line source code with automatic syntax highlighting and a copy-to-clipboard control.
   * @tag code
   * @tag snippet
   * @useWhen Displaying a multi-line code sample or terminal transcript inside documentation or chat.
   * @useWhen Letting the reader copy a snippet to the clipboard via the copyable prop.
   * @avoidWhen Annotating a single inline keystroke or shortcut — use kbd instead.
   * @avoidWhen Rendering rich prose that happens to include code — embed it in markdown instead.
   * @related kbd, copy-button
   */
  export type { CodeBlockProps } from './code-block.types.ts';
</script>

<script lang="ts">
  import { loadDefaultHighlighter } from './code-block-default-highlighter.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import CopyButton from '../copy-button/copy-button.svelte';
  import type { CodeBlockProps } from './code-block.types.ts';

  let {
    code,
    language,
    highlight,
    highlighter,
    copyable = false,
    showLanguageLabel = true,
    class: className,
  }: CodeBlockProps = $props();

  let highlighted = $state<string | null>(null);

  // Two-phase render contract: the server (and the first client paint) emits
  // the plain `<pre><code>` fallback because `$effect` never runs during SSR.
  // The effect below — client-only by definition — enhances the block to the
  // highlighted HTML once the highlighter resolves. The outer viewport stays
  // mounted across both phases so syntax colorization cannot move surrounding
  // layout. Keeping the Shiki boundary a dynamic import inside this effect is
  // what keeps Shiki out of the SSR bundle and the consumer's entry chunk.
  $effect(() => {
    // `highlight={false}` is an absolute off switch: it disables ALL
    // highlighting — including an explicit `highlighter` prop — and triggers
    // NO default-highlighter import. The block stays the escaped plain
    // fallback. (Default when unset: highlight whenever `language` is set.)
    if (highlight === false || !language) {
      highlighted = null;
      return;
    }

    // Snapshot the inputs this run highlights so a later `code`/`language`/
    // `highlighter` change can't let a stale (and `{@html}`-trusted) result
    // overwrite a newer state. The cleanup flips `cancelled`, which gates
    // EVERY assignment below — including the one after the async default
    // load resolves.
    const pendingCode = code;
    const pendingLanguage = language;
    const explicitHighlighter = highlighter;

    // Drop any stale highlighted output before starting a new request so a
    // change can't leave the previous render visible while the new request
    // is in flight.
    highlighted = null;
    let cancelled = false;

    // The highlighter may throw synchronously OR reject, and resolving the
    // default highlighter is itself async — wrap everything in one async IIFE
    // so all failure modes hit the same `catch`.
    void (async () => {
      try {
        // An explicit `highlighter` bypasses the default entirely: the default
        // loader is never imported, so its Shiki load + factory side effects
        // never fire (asserted in the unit tests).
        const resolvedHighlighter = explicitHighlighter ?? (await loadDefaultHighlighter());
        if (cancelled) return;
        const html = await resolvedHighlighter(pendingCode, pendingLanguage);
        if (!cancelled) highlighted = html === '' ? null : html;
      } catch (error) {
        if (!cancelled) highlighted = null;
        // Surface to the developer without breaking the graceful fallback.
        // Never log the code itself — a code block can contain secrets. Log
        // the language and the error class/message only.
        const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        devWarn(`[cinder/CodeBlock] highlight failed for language "${pendingLanguage}":`, detail);
      }
    })();

    return () => {
      cancelled = true;
    };
  });
</script>

<div class={classNames('cinder-code-block', className)}>
  {#if (language && showLanguageLabel) || copyable}
    <header class="cinder-code-block__header">
      {#if language && showLanguageLabel}
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
  <!-- One stable, focusable scroll viewport is shared by plain, highlighted,
       and fallback states. Keep tabindex unconditional so overflowing snippets
       are keyboard-scrollable before measurement. -->
  <div class="cinder-code-block__viewport" tabindex="0">
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
        <div class="cinder-code-block__highlighted">
          {@html highlighted}
        </div>
      {:else}
        <pre class="cinder-code-block__pre"><code class="cinder-code-block__code">{code}</code
          ></pre>
      {/if}
      {#snippet failed()}
        <pre class="cinder-code-block__pre"><code class="cinder-code-block__code">{code}</code
          ></pre>
      {/snippet}
    </svelte:boundary>
  </div>
</div>
