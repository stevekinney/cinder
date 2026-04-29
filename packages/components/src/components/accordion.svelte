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

  import { createMultiSelection } from '../_internal/collection.ts';
  import { classNames } from '../utilities/class-names.ts';

  let {
    multiple = false,
    expandedIds = $bindable([]),
    class: className,
    children,
  }: AccordionProps = $props();

  // Multi-mode delegates to the shared collection helper; single-mode keeps the
  // "open one at a time" invariant local. Both update `expandedIds` in place so
  // the bindable parent prop sees the change.
  const multi = createMultiSelection<string>(
    () => expandedIds,
    (next) => {
      expandedIds = next;
    },
  );

  function toggle(id: string): void {
    if (multiple) {
      multi.toggle(id);
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
