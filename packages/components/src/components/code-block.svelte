<script lang="ts" module>
  /**
   * Props for the CodeBlock component.
   *
   * Renders preformatted code in a `<pre><code>` element. No syntax
   * highlighting is applied by default. Consumers can provide a highlighter when they
   * own the syntax-highlighting dependency and output sanitization contract.
   */
  export type CodeBlockProps = {
    /** The code to render. */
    code: string;
    /** Optional language label rendered in the header. */
    language?: string;
    /** When true, render a copy button in the header. */
    copyable?: boolean;
    /** @param highlighter — function that returns syntax-highlighted HTML. Return value is rendered with `{@html}` and is the caller's responsibility to ensure it is safe (e.g. that input code is escaped). Shiki's `codeToHtml` is a safe default. */
    highlighter?: (code: string, lang: string) => string | Promise<string>;
    /** Additional class names merged with `.cinder-code-block`. */
    class?: string;
  };
</script>

<script lang="ts">
  import CopyButton from './copy-button.svelte';
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
    let cancelled = false;
    Promise.resolve(highlighter(code, language))
      .then((html) => {
        if (!cancelled) highlighted = html;
      })
      .catch(() => {
        if (!cancelled) highlighted = null;
      });
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
          iconOnly={true}
        />
      {/if}
    </header>
  {/if}
  <svelte:boundary>
    {#if highlighted}
      {@html highlighted}
    {:else}
      <pre class="cinder-code-block__pre"><code class="cinder-code-block__code">{code}</code></pre>
    {/if}
    {#snippet failed()}
      <pre class="cinder-code-block__pre"><code class="cinder-code-block__code">{code}</code></pre>
    {/snippet}
  </svelte:boundary>
</div>
