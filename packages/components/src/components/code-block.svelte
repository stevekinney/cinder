<script lang="ts" module>
  /**
   * Props for the CodeBlock component.
   *
   * Renders preformatted code in a `<pre><code>` element. Plain code is
   * Svelte-text-interpolated so HTML entities are escaped automatically.
   * Syntax highlighting is opt-in via the `highlighter` prop — when provided,
   * the highlighter's HTML output replaces the entire `<pre><code>` block and
   * is rendered via `{@html}`, so the caller owns the sanitization contract.
   */
  export type CodeBlockProps = {
    /** The code to render. */
    code: string;
    /** Optional language label rendered in the header. */
    language?: string;
    /** When true, render a copy button in the header. */
    copyable?: boolean;
    /**
     * Optional syntax highlighter. Receives the raw `code` and `lang` and must
     * return an HTML string (sync or async). The return value is rendered with
     * `{@html}` and replaces the default `<pre><code>` markup — including the
     * `cinder-code-block__pre` / `__code` classes — so the caller is also
     * responsible for matching any structural CSS the consumer relies on
     * (Shiki's own `<pre class="shiki ...">` output covers most cases).
     *
     * The return value is rendered verbatim with `{@html}`. It is the caller's
     * responsibility to ensure the output is safe — specifically, that the
     * input `code` is escaped. Shiki's `codeToHtml` escapes input by default
     * and is the recommended choice.
     *
     * Only invoked when `language` is also set. Theme/color-scheme selection
     * is the caller's responsibility — pass it through closure.
     */
    highlighter?: (code: string, lang: string) => string | Promise<string>;
    /** Additional class names merged with `.cinder-code-block`. */
    class?: string;
  };
</script>

<script lang="ts">
  import CopyButton from './copy-button/copy-button.svelte';
  import { cn } from '../utilities/class-names.ts';

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
