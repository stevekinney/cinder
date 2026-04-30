<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  /**
   * Props for the Kbd component.
   *
   * Renders a `<kbd>` element styled to look like a physical keyboard key.
   * Use to indicate keyboard shortcuts in tooltips, command palettes, and
   * help text.
   */
  export type KbdSize = 'sm' | 'md';

  type KbdBaseProps = HTMLAttributes<HTMLElement> & {
    /** Additional class names merged with `.cinder-kbd`. */
    class?: string;
    /** Keyboard key size. */
    size?: KbdSize;
  };

  type KbdWithLabel = KbdBaseProps & {
    /** Key label content. */
    label: string;
    children?: Snippet;
  };

  type KbdWithChildren = KbdBaseProps & {
    /** Key label content. */
    label?: string;
    /** Key label content. */
    children: Snippet;
  };

  export type KbdProps = KbdWithLabel | KbdWithChildren;
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  let { class: customClassName, size = 'md', label, children, ...rest }: KbdProps = $props();
</script>

<kbd class={classNames('cinder-kbd', customClassName)} data-cinder-size={size} {...rest}>
  {#if children}{@render children()}{:else}{label}{/if}
</kbd>
