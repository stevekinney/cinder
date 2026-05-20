<script lang="ts" module>
  export type { DropdownSeparatorProps } from './dropdown-separator.types.ts';
</script>

<script lang="ts">
  import type { DropdownSeparatorProps } from './dropdown-separator.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let { class: customClassName, ...rest }: DropdownSeparatorProps = $props();
</script>

<div
  class={classNames('cinder-dropdown-separator', customClassName)}
  role="separator"
  {...rest}
></div>
