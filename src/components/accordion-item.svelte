<script lang="ts" module>
  import type { Snippet } from 'svelte';

  /** Props for the AccordionItem component. */
  export type AccordionItemProps = {
    /** Unique identifier matched against Accordion's expandedIds. */
    id: string;
    /** Visible header label for the item. */
    title: string;
    /** When true, the item cannot be toggled. Default: false. */
    disabled?: boolean;
    /** Additional CSS class merged with `.cinder-accordion-item`. */
    class?: string;
    /** Panel content rendered when the item is expanded. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { getContext } from 'svelte';

  import { ACCORDION_CONTEXT_KEY, type AccordionContext } from './accordion.svelte';
  import { classNames } from '../utilities/class-names.ts';

  let { id, title, disabled = false, class: className, children }: AccordionItemProps = $props();

  const context = getContext<AccordionContext>(ACCORDION_CONTEXT_KEY);

  const isExpanded = $derived(context.expandedIds.includes(id));

  const headerId = $derived(`${id}-header`);
  const panelId = $derived(`${id}-panel`);

  function handleClick(): void {
    if (disabled) return;
    context.toggle(id);
  }
</script>

<div
  class={classNames('cinder-accordion-item', className)}
  data-cinder-expanded={isExpanded ? '' : undefined}
  data-cinder-disabled={disabled ? '' : undefined}
>
  <h3 class="cinder-accordion-item__heading">
    <button
      type="button"
      id={headerId}
      class="cinder-accordion-item__trigger"
      aria-expanded={isExpanded}
      aria-controls={panelId}
      {disabled}
      aria-disabled={disabled ? 'true' : undefined}
      onclick={handleClick}
    >
      <span class="cinder-accordion-item__title">{title}</span>
      <svg
        class="cinder-accordion-item__chevron"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill-rule="evenodd"
          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
          clip-rule="evenodd"
        />
      </svg>
    </button>
  </h3>

  {#if isExpanded}
    <div id={panelId} class="cinder-accordion-item__panel" role="region" aria-labelledby={headerId}>
      <div class="cinder-accordion-item__panel-inner">
        {@render children()}
      </div>
    </div>
  {/if}
</div>
