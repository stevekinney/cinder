<script lang="ts" module>
  /**
   * Props for the CodeBlock component.
   *
   * Renders preformatted code in a `<pre><code>` element. **No syntax
   * highlighting** — that's a consumer concern (depict already owns Shiki).
   * If you want highlighting, run the consumer's highlighter on the source
   * and pass the resulting HTML through a different surface, or compose
   * your own component on top of these primitives.
   */
  export type CodeBlockProps = {
    /** The code to render. */
    code: string;
    /** Optional language label rendered in the header. */
    language?: string;
    /** When true, render a copy button in the header. */
    copyable?: boolean;
    /** Additional class names merged with `.cinder-code-block`. */
    class?: string;
  };
</script>

<script lang="ts">
  import CopyButton from './copy-button.svelte';
  import { cn } from '../utilities/class-names.ts';

  let { code, language, copyable = false, class: className }: CodeBlockProps = $props();
</script>

<div class={cn('cinder-code-block', className)}>
  {#if language || copyable}
    <header class="cinder-code-block__header">
      {#if language}
        <span class="cinder-code-block__language">{language}</span>
      {/if}
      {#if copyable}
        <CopyButton value={code} class="cinder-code-block__copy" label="Copy code" />
      {/if}
    </header>
  {/if}
  <pre class="cinder-code-block__pre"><code class="cinder-code-block__code">{code}</code></pre>
</div>
