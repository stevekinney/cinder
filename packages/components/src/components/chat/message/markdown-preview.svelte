<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';

  export type ChatMarkdownPreviewProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    content: string;
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../../utilities/class-names.ts';

  let { content, class: className, ...rest }: ChatMarkdownPreviewProps = $props();

  let renderedHtml = $state('');

  $effect(() => {
    let cancelled = false;

    void import('@cinder/markdown/rendering').then(
      ({ renderMarkdown }) => {
        if (cancelled) return;
        try {
          renderedHtml = renderMarkdown(content).html;
        } catch {
          renderedHtml = '';
        }
      },
      () => {
        if (!cancelled) {
          renderedHtml = '';
        }
      },
    );

    return () => {
      cancelled = true;
    };
  });
</script>

<div class={classNames('message-content-preview', className)} {...rest}>
  {#if renderedHtml}
    {@html renderedHtml}
  {:else}
    <p>{content}</p>
  {/if}
</div>
