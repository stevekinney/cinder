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
   * @avoidWhen Switching between mutually exclusive views of the same region. | tabs
   * @avoidWhen Hiding a single optional region — reach for a plain disclosure instead. | collapsible
   * @related accordion-item, tabs, tree
   * @a11yPattern WAI-ARIA Accordion
   * @keyboardShortcut Tab | Moves focus to the next focusable element (accordion header buttons are in the natural tab order).
   * @keyboardShortcut Shift + Tab | Moves focus to the previous focusable element.
   * @keyboardShortcut Enter / Space | When focus is on a header button, toggles the associated panel open or closed.
   * @a11yNote Each trigger is a native button exposing aria-expanded and aria-controls, so screen readers announce open/closed state.
   * @a11yNote Panels intentionally omit role="region" to keep the page's landmark list clean.
   * @a11yNote Disabled items set the native disabled attribute on their trigger, removing them from the tab order.
   */
  export type { AccordionContext, AccordionProps } from './accordion.types.ts';
</script>

<script lang="ts">
  import { createMultiSelection } from '../../_internal/collection.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { setAccordionContext } from './accordion.context.ts';
  import type { AccordionProps } from './accordion.types.ts';

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

  setAccordionContext({
    get expandedIds() {
      return expandedIds;
    },
    toggle,
  });
</script>

<div class={classNames('cinder-accordion', className)}>
  {@render children()}
</div>
