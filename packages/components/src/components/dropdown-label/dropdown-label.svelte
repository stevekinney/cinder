<script lang="ts" module>
  export type { DropdownLabelProps } from './dropdown-label.types.ts';
</script>

<script lang="ts">
  import type { DropdownLabelProps } from './dropdown-label.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let { class: customClassName, children, ...rest }: DropdownLabelProps = $props();
</script>

<div class={classNames('cinder-dropdown-label', customClassName)} {...rest}>
  {#if children}
    {@render children()}
  {/if}
</div>
