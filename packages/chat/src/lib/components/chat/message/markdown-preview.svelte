<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { ChatMarkdownNode, MarkdownNodeOverride } from './chat-message-parts.ts';

  export type ChatMarkdownPreviewProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    content: string;
    class?: string;
    markdownNode?: MarkdownNodeOverride | undefined;
  };
</script>

<script lang="ts">
  import { classNames } from '../../../utilities/class-names.ts';
  import CodeBlock from '@lostgradient/cinder/code-block';
  import { preloadMarkdownPipeline } from './markdown-pipeline.ts';

  type MarkdownSegment = { kind: 'html'; html: string } | { kind: 'node'; node: ChatMarkdownNode };

  let { content, markdownNode, class: className, ...rest }: ChatMarkdownPreviewProps = $props();

  let renderedHtml = $state('');
  let segments = $state<MarkdownSegment[]>([]);

  function segmentRenderedHtml(html: string): MarkdownSegment[] {
    const template = document.createElement('template');
    template.innerHTML = html;
    const result: MarkdownSegment[] = [];
    let ordinaryHtml = '';
    let nodeIndex = 0;

    function flushOrdinaryHtml(): void {
      if (!ordinaryHtml) return;
      result.push({ kind: 'html', html: ordinaryHtml });
      ordinaryHtml = '';
    }

    for (const child of template.content.childNodes) {
      if (!(child instanceof HTMLElement)) {
        ordinaryHtml += child.textContent ?? '';
        continue;
      }

      if (!child.matches('cinder-markdown-node')) {
        ordinaryHtml += child.outerHTML;
        continue;
      }

      flushOrdinaryHtml();
      const kind = child.dataset['cinderMarkdownKind'] as ChatMarkdownNode['kind'];
      result.push({
        kind: 'node',
        node: {
          kind,
          html: child.innerHTML,
          text: child.textContent ?? '',
          language: child.dataset['language'],
          index: Number(child.dataset['cinderMarkdownIndex'] ?? nodeIndex++),
        },
      });
    }
    flushOrdinaryHtml();
    return result;
  }

  $effect(() => {
    // Capture the content snapshot for this run. If `content` updates
    // mid-render (streaming chat), the next $effect run cancels this one
    // via the cleanup function; we still don't want stale HTML written
    // back if a microtask from this run lands after cancellation.
    const snapshot = content;

    // Clear the previously rendered HTML synchronously so the fallback
    // `<p>{content}</p>` below renders the new raw text immediately
    // while the async pipeline produces the formatted version. Without
    // this reset, a streaming or reused message briefly shows the
    // previous content's rendered HTML during the re-render gap.
    renderedHtml = '';
    segments = [];

    let cancelled = false;

    // Defer the rendering-pipeline import past first paint via a single
    // animation frame. requestAnimationFrame fires before the next paint,
    // which is a predictable upper bound (~16 ms at 60 Hz). We
    // intentionally do not use requestIdleCallback here: a chat UI is on
    // the user's critical visual path, and an idle deadline of even a
    // few hundred milliseconds would leave raw markdown source visible
    // for that whole window.
    //
    // Cancelling the rAF on cleanup also collapses rapid streaming
    // updates: each new content arrival cancels the pending frame and
    // schedules its own, so the renderer runs at most once per frame
    // even under per-token streaming.
    const handle = requestAnimationFrame(() => {
      if (cancelled) return;
      const pipelinePromise = preloadMarkdownPipeline();
      if (!pipelinePromise) return;
      void pipelinePromise
        .then(async (pipeline) => {
          if (!pipeline || cancelled) return;
          const { renderMarkdownWithMath } = pipeline;
          try {
            const result = await renderMarkdownWithMath(snapshot);
            // Re-check cancelled and verify the snapshot still matches
            // the live content. The latter handles a subtle race: if
            // content updates AFTER cancelled was set but BEFORE this
            // microtask runs, cancelled would already be true. The
            // snapshot equality check is defense in depth — if the
            // cleanup function ever fails to fire, we still avoid
            // committing HTML that doesn't match the current props.
            if (!cancelled && snapshot === content) {
              renderedHtml = result.html;
              segments = segmentRenderedHtml(result.html);
            }
          } catch {
            if (!cancelled && snapshot === content) renderedHtml = '';
          }
        })
        .catch(() => {
          if (!cancelled && snapshot === content) renderedHtml = '';
        });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
    };
  });
</script>

{#snippet renderDefaultNode(node: ChatMarkdownNode)}
  <div class="message-content-wide" data-cinder-markdown-node={node.kind}>
    {#if node.kind === 'code-block' || node.kind === 'mermaid'}
      {#if node.language || node.kind === 'mermaid'}
        <CodeBlock code={node.text} language={node.language ?? 'mermaid'} />
      {:else}
        <CodeBlock code={node.text} />
      {/if}
    {:else}
      {@html node.html}
    {/if}
  </div>
{/snippet}

<div class={classNames('cinder-markdown-content message-content-preview', className)} {...rest}>
  {#if renderedHtml}
    {#if markdownNode}
      {#each segments as segment, index (`${segment.kind}:${index}`)}
        {#if segment.kind === 'node'}
          {@render markdownNode(segment.node, renderDefaultNode)}
        {:else}
          {@html segment.html}
        {/if}
      {/each}
    {:else}
      {@html renderedHtml}
    {/if}
  {:else}
    <p>{content}</p>
  {/if}
</div>
