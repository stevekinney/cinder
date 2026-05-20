<script lang="ts" module>
  /**
   * @cinder
   * @category typography
   * @status stable
   * @purpose Inline element that styles a single keystroke or shortcut sequence with the semantic kbd tag.
   * @tag shortcut
   * @tag inline
   * @useWhen Calling out a keyboard shortcut inline within prose or a tooltip.
   * @useWhen Composing chorded shortcuts by rendering multiple kbd elements side by side.
   * @avoidWhen Displaying a block of source code — use code-block instead.
   * @related code-block
   */
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
