<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Collapsible panel within an accordion that toggles its content visibility under a heading button.
   * @tag disclosure
   * @tag collapsible
   * @useWhen Rendering one expandable section inside an accordion parent.
   * @useWhen Disabling a single section while leaving siblings interactive via the disabled prop.
   * @avoidWhen Standing alone outside an accordion — it requires the accordion context to function.
   * @related accordion
   */
  export type { AccordionItemProps } from './accordion-item.types.ts';
</script>

<script lang="ts">
  import { getContext } from 'svelte';

  import { ACCORDION_CONTEXT_KEY } from '../accordion/accordion.context.ts';
  import type { AccordionContext } from '../accordion/accordion.types.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import type { AccordionItemProps } from './accordion-item.types.ts';

  let { id, title, disabled = false, class: className, children }: AccordionItemProps = $props();

  const rawContext = getContext<AccordionContext | undefined>(ACCORDION_CONTEXT_KEY);
  if (!rawContext) {
    throw new Error('AccordionItem must be used inside an Accordion component.');
  }
  const context: AccordionContext = rawContext;

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
    <div id={panelId} class="cinder-accordion-item__panel">
      <div class="cinder-accordion-item__panel-inner">
        {@render children()}
      </div>
    </div>
  {/if}
</div>
