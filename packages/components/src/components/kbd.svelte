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
  export type KbdProps = HTMLAttributes<HTMLElement> & {
    /** Additional class names merged with `.cinder-kbd`. */
    class?: string;
    /** Key label content. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  let { class: className, children, ...rest }: KbdProps = $props();
</script>

<kbd class={cn('cinder-kbd', className)} {...rest}>
  {@render children()}
</kbd>
