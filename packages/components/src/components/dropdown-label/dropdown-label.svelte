<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Non-interactive heading row that groups related dropdown-item rows inside a dropdown-menu.
   * @tag overlay
   * @tag menu
   * @useWhen Labeling a group of related menu items with a short heading.
   * @useWhen Providing a visual section title above a cluster of dropdown-item rows.
   * @avoidWhen Rendering a selectable row — use dropdown-item.
   * @avoidWhen Visually dividing groups without a heading — use dropdown-separator.
   * @related dropdown, dropdown-menu, dropdown-item, dropdown-separator
   */
  export type { DropdownLabelProps } from './dropdown-label.types.ts';
</script>

<script lang="ts">
  import type { DropdownLabelProps } from './dropdown-label.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let { class: customClassName, children, ...rest }: DropdownLabelProps = $props();
</script>

<!-- {...rest} is spread first so the intrinsic role="presentation" — DropdownLabel's
     sole correct role inside a role="menu" — cannot be overridden by a consumer. -->
<div {...rest} class={classNames('cinder-dropdown-label', customClassName)} role="presentation">
  {#if children}
    {@render children()}
  {/if}
</div>
