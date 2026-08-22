<script lang="ts">
  import { CopyButton } from '@lostgradient/cinder/copy-button';

  type Props = {
    code: string;
    language?: string;
    highlightedHtml: string;
    copyable?: boolean;
  };

  let { code, language, highlightedHtml, copyable = false }: Props = $props();
  const singleFocusTargetHtml = $derived(
    highlightedHtml.replace(/(<pre\b[^>]*?)\s+tabindex=(['"])0\2/i, '$1'),
  );
</script>

<div class="cinder-code-block" data-readme-code-block>
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
  <!-- The README renderer already initialized Shiki and sanitized this HTML at
       build time. Rendering that exact result here preserves the CodeBlock
       frame while making highlighted tokens part of the exported document. -->
  <div class="cinder-code-block__viewport" tabindex="0">
    {#if highlightedHtml !== ''}
      <div class="cinder-code-block__highlighted">
        {@html singleFocusTargetHtml}
      </div>
    {:else}
      <pre class="cinder-code-block__pre"><code class="cinder-code-block__code">{code}</code></pre>
    {/if}
  </div>
</div>
