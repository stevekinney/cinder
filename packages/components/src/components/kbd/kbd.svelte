<script lang="ts" module>
  export type { KbdProps, KbdSize } from './kbd.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type { KbdProps } from './kbd.types.ts';

  let { class: customClassName, size = 'md', label, children, ...rest }: KbdProps = $props();
</script>

<kbd class={classNames('cinder-kbd', customClassName)} data-cinder-size={size} {...rest}>
  {#if children}{@render children()}{:else}{label}{/if}
</kbd>
