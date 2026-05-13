<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  /** Visual/layout orientation of the group. */
  export type ButtonGroupOrientation = 'horizontal' | 'vertical';

  type ButtonGroupBase = Omit<
    HTMLAttributes<HTMLDivElement>,
    'class' | 'role' | 'aria-label' | 'aria-labelledby'
  > & {
    /** Orientation of the visual collapse. Default: 'horizontal'. */
    orientation?: ButtonGroupOrientation;
    /** Additional class merged with `.cinder-button-group`. */
    class?: string;
    /** Buttons (or split-button compositions) to render inside the group. */
    children: Snippet;
  };

  /**
   * Layout-only grouping container for related action buttons.
   * Requires an accessible name via either `label` (for inline labelling)
   * or `labelledBy` (when a visible heading already names the group).
   * Exactly one must be provided.
   */
  export type ButtonGroupProps = ButtonGroupBase &
    ({ label: string; labelledBy?: never } | { label?: never; labelledBy: string });
</script>

<script lang="ts">
  import type { Attachment } from 'svelte/attachments';
  import { DEV } from 'esm-env';

  import { classNames } from '../utilities/class-names.ts';

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

  function tagDirectChildren(): Attachment {
    return (element) => {
      const ATTR = 'data-cinder-button-group-item';
      const tagged = new Set<Element>();

      const sync = () => {
        const currentChildren = new Set(Array.from(element.children));

        for (const child of currentChildren) {
          if (!child.hasAttribute(ATTR)) child.setAttribute(ATTR, '');
          tagged.add(child);
        }

        for (const previouslyTagged of tagged) {
          if (!currentChildren.has(previouslyTagged)) {
            previouslyTagged.removeAttribute(ATTR);
            tagged.delete(previouslyTagged);
          }
        }
      };

      sync();

      const observer = new MutationObserver(sync);
      observer.observe(element, { childList: true });
      return () => observer.disconnect();
    };
  }

  $effect(() => {
    if (!DEV) return;

    const hasLabel = typeof label === 'string';
    const hasLabelledBy = typeof labelledBy === 'string';

    if (!hasLabel && !hasLabelledBy) {
      console.warn(
        "[cinder/ButtonGroup] rendered without a non-empty accessible name — pass a non-empty 'label' or 'labelledBy'.",
      );
      return;
    }

    if (hasLabel && label.trim().length === 0) {
      console.warn(
        "[cinder/ButtonGroup] rendered without a non-empty accessible name — pass a non-empty 'label' or 'labelledBy'.",
      );
    }

    if (hasLabelledBy && labelledBy.trim().length === 0) {
      console.warn(
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
  aria-orientation={orientation}
  class={mergedClassName}
  data-cinder-orientation={orientation}
  {@attach tagDirectChildren()}
>
  {@render children()}
</div>
