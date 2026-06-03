<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Horizontal divider with role="separator" that visually segments groups of rows inside a dropdown-menu.
   * @tag overlay
   * @tag menu
   * @useWhen Visually splitting unrelated groups of dropdown-item rows without adding a heading.
   * @useWhen Marking a boundary between primary actions and destructive or secondary actions in a menu.
   * @avoidWhen Labeling a section of items — use dropdown-label so the group has an accessible heading.
   * @avoidWhen Rendering an interactive row — use dropdown-item.
   * @related dropdown, dropdown-menu, dropdown-label, dropdown-item
   */
  export type { DropdownSeparatorProps } from './dropdown-separator.types.ts';
</script>

<script lang="ts">
  import type { DropdownSeparatorProps } from './dropdown-separator.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let { class: customClassName, ...rest }: DropdownSeparatorProps = $props();
</script>

<!--
  `{...rest}` is spread first so the component's own role="separator" — its sole
  semantic purpose — wins against any role a caller passes through their spread.
-->
<div
  {...rest}
  class={classNames('cinder-dropdown-separator', customClassName)}
  role="separator"
></div>
