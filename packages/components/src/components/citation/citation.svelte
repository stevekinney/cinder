<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status beta
   * @purpose Inline citation marker opening a paginated preview of source references.
   * @tag citation
   * @useWhen Attaching sources to an inline claim or generated answer.
   * @avoidWhen Building a full bibliography page.
   * @related popover
   * @rationale Nearest alternative: Popover — Citation adds source pagination and an inline marker.
   */
  export type { CitationProps, CitationSource } from './citation.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Popover from '../popover/index.ts';

  import type { CitationProps } from './citation.types.ts';

  let {
    sources = [],
    label = 'Sources',
    children,
    class: customClassName,
    ...rest
  }: CitationProps = $props();
  let page = $state(0);
  let open = $state(false);
  const source = $derived(sources[page]);
  $effect(() => {
    if (page >= sources.length) page = Math.max(0, sources.length - 1);
  });
</script>

<span class={classNames('cinder-citation', customClassName)} {...rest}
  >{#if children}{@render children()}{/if}<Popover bind:open {label}>
    {#snippet trigger()}<button
        type="button"
        class="cinder-citation__marker"
        onclick={() => (open = !open)}
        aria-label={`${label} (${sources.length})`}>[{sources.length}]</button
      >{/snippet}
    <section aria-label={label}>
      <strong>{source?.label}</strong>{#if source?.detail}<p>
          {source.detail}
        </p>{/if}{#if source?.url}<a href={source.url}>Open source</a>{/if}
      {#if sources.length > 1}<div class="cinder-citation__pagination">
          <button
            type="button"
            onclick={() => (page = Math.max(0, page - 1))}
            disabled={page === 0}
            aria-label="Previous source">Previous</button
          ><span aria-live="polite">{page + 1} of {sources.length}</span><button
            type="button"
            onclick={() => (page = Math.min(sources.length - 1, page + 1))}
            disabled={page === sources.length - 1}
            aria-label="Next source">Next</button
          >
        </div>{/if}
    </section>
  </Popover></span
>
