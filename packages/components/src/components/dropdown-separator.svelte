<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';

  export type DropdownSeparatorProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  let { class: customClassName, ...rest }: DropdownSeparatorProps = $props();
</script>

<div
  class={classNames('cinder-dropdown-separator', customClassName)}
  role="separator"
  {...rest}
></div>
