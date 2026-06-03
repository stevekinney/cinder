<script lang="ts" module>
  /**
   * @cinder
   * @category action
   * @status stable
   * @purpose Visual and semantic grouping of related buttons that share a single accessible label and present as one connected control.
   * @tag action
   * @tag grouping
   * @useWhen Clustering related actions such as align-left/center/right that read as a single toolset.
   * @useWhen Visually joining multiple buttons into a single segmented bar without implying selection.
   * @avoidWhen Selecting exactly one option from a fixed set — use segmented-control instead.
   * @avoidWhen Rendering a single button — use button on its own.
   * @related button, segmented-control
   */
  let groupIdCounter = 0;

  export type { ButtonGroupOrientation, ButtonGroupProps } from './button-group.types.ts';
</script>

<script lang="ts">
  import type { ButtonGroupProps } from './button-group.types.ts';
  import type { Attachment } from 'svelte/attachments';

  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';

  let {
    label,
    labelledBy,
    orientation = 'horizontal',
    class: customClassName,
    children,
    ...rest
  }: ButtonGroupProps = $props();

  const mergedClassName = $derived(classNames('cinder-button-group', customClassName));
  const ariaLabelAttribute = $derived(typeof label === 'string' ? label : undefined);
  const ariaLabelledByAttribute = $derived(typeof labelledBy === 'string' ? labelledBy : undefined);

  // Each group instance gets a unique ID so the styling-contract attribute
  // carries ownership. When a child moves from one group to another, the new
  // group overwrites the value and the old group's cleanup only removes it if
  // the value still matches this instance's ID.
  const groupId = String(++groupIdCounter);

  const tagDirectChildren: Attachment = (element) => {
    const ATTR = 'data-cinder-button-group-item';
    // Track previously tagged children by element reference so cleanup is
    // O(n) and ownership-specific: we only remove our group's tag value.
    const tagged = new Set<Element>();

    const sync = () => {
      const currentChildren = new Set(Array.from(element.children));

      // Stamp current direct children with this group's ID. Overwriting
      // another group's ID claims ownership — the other group's cleanup will
      // see a mismatched value and skip removal, so no double-remove race.
      for (const child of currentChildren) {
        child.setAttribute(ATTR, groupId);
        tagged.add(child);
      }

      // Remove ownership from children that are no longer direct children.
      // Only remove if the value still matches this group's ID — prevents
      // clobbering a new group that already claimed the child.
      for (const previouslyTagged of Array.from(tagged)) {
        if (!currentChildren.has(previouslyTagged)) {
          if (previouslyTagged.getAttribute(ATTR) === groupId) {
            previouslyTagged.removeAttribute(ATTR);
          }
          tagged.delete(previouslyTagged);
        }
      }
    };

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(element, { childList: true });
    return () => {
      observer.disconnect();
      // Release ownership on unmount for any remaining tagged children.
      for (const child of Array.from(tagged)) {
        if (child.getAttribute(ATTR) === groupId) {
          child.removeAttribute(ATTR);
        }
      }
    };
  };

  $effect(() => {
    const hasLabel = typeof label === 'string';
    const hasLabelledBy = typeof labelledBy === 'string';

    if (!hasLabel && !hasLabelledBy) {
      devWarn(
        "[cinder/ButtonGroup] rendered without a non-empty accessible name — pass a non-empty 'label' or 'labelledBy'.",
      );
      return;
    }

    if (hasLabel && label.trim().length === 0) {
      devWarn(
        "[cinder/ButtonGroup] rendered without a non-empty accessible name — pass a non-empty 'label' or 'labelledBy'.",
      );
    }

    if (hasLabelledBy && labelledBy.trim().length === 0) {
      devWarn(
        "[cinder/ButtonGroup] rendered without a non-empty accessible name — pass a non-empty 'label' or 'labelledBy'.",
      );
    }
  });
</script>

<div
  {...rest}
  role="group"
  aria-label={ariaLabelAttribute}
  aria-labelledby={ariaLabelledByAttribute}
  class={mergedClassName}
  data-cinder-orientation={orientation}
  {@attach tagDirectChildren}
>
  {@render children()}
</div>
