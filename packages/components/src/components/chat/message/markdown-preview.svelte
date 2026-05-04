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
    // Defer the rendering-pipeline import past first paint. The fallback
    // <p>{content}</p> below shows the raw message text immediately, so
    // postponing the chunk fetch by one idle tick (or one frame on
    // browsers without requestIdleCallback) costs nothing user-visible
    // and keeps the entry chunk's first-paint critical path lean.
    let cancelled = false;

    const start = (): void => {
      if (cancelled) return;
      // Use renderMarkdownWithMath so messages containing math ($x$, $$…$$)
      // render via KaTeX. The async entry pre-checks the content for
      // math markers and only loads remark-math/rehype-katex when needed,
      // so math-free messages don't pull in the katex chunk.
      void import('@cinder/markdown/rendering')
        .then(async ({ renderMarkdownWithMath }) => {
          if (cancelled) return;
          try {
            const result = await renderMarkdownWithMath(content);
            if (!cancelled) renderedHtml = result.html;
          } catch {
            if (!cancelled) renderedHtml = '';
          }
        })
        .catch(() => {
          if (!cancelled) renderedHtml = '';
        });
    };

    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(start, { timeout: 200 });
      return () => {
        cancelled = true;
        if (typeof cancelIdleCallback === 'function') cancelIdleCallback(id);
      };
    }
    const handle = requestAnimationFrame(() => queueMicrotask(start));
    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
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
