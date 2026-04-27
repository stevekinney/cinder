<script lang="ts" module>
  import type { Snippet } from 'svelte';

  /** Symbol key for the accordion Svelte context. */
  export const ACCORDION_CONTEXT_KEY = Symbol('cinder-accordion');

  /** Shape of the context object provided to AccordionItem children. */
  export type AccordionContext = {
    readonly expandedIds: string[];
    toggle: (id: string) => void;
  };

  /** Props for the Accordion component. */
  export type AccordionProps = {
    /** When true, multiple items may be expanded simultaneously. Default: false. */
    multiple?: boolean;
    /** The currently expanded item IDs. Bindable. */
    expandedIds: string[];
    /** Additional CSS class merged with `.cinder-accordion`. */
    class?: string;
    /** AccordionItem children. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { setContext } from 'svelte';

  import { classNames } from '../utilities/class-names.ts';

  let {
    multiple = false,
    expandedIds = $bindable([]),
    class: className,
    children,
  }: AccordionProps = $props();

  /**
   * Toggle the expanded state of an item by its id.
   *
   * - `multiple=false`: if the item is already open, collapse it (set expandedIds to []);
   *   otherwise replace expandedIds with [id] so only one item is ever open.
   * - `multiple=true`: toggle the id in/out of the expandedIds array.
   */
  function toggle(id: string): void {
    if (multiple) {
      if (expandedIds.includes(id)) {
        expandedIds = expandedIds.filter((existing) => existing !== id);
      } else {
        expandedIds = [...expandedIds, id];
      }
    } else {
      expandedIds = expandedIds.includes(id) ? [] : [id];
    }
  }

  setContext<AccordionContext>(ACCORDION_CONTEXT_KEY, {
    get expandedIds() {
      return expandedIds;
    },
    toggle,
  });
</script>

<div class={classNames('cinder-accordion', className)}>
  {@render children()}
</div>
