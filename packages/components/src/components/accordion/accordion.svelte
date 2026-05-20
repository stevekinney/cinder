<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Composite root that coordinates a stack of collapsible accordion-item panels with single or multiple expansion.
   * @tag disclosure
   * @tag collapsible
   * @useWhen Progressively disclosing several sections of content that share a parent heading.
   * @useWhen Letting the consumer expand one or multiple panels at once via the multiple prop.
   * @avoidWhen Switching between mutually exclusive views of the same region — use tabs instead.
   * @avoidWhen Hiding a single optional region — use a plain disclosure or details element.
   * @related accordion-item, tabs, tree
   */
  export { ACCORDION_CONTEXT_KEY } from './accordion.context.ts';
  export type { AccordionContext, AccordionProps } from './accordion.types.ts';
</script>

<script lang="ts">
  import { setContext } from 'svelte';

  import { createMultiSelection } from '../../_internal/collection.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { ACCORDION_CONTEXT_KEY } from './accordion.context.ts';
  import type { AccordionContext, AccordionProps } from './accordion.types.ts';

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
