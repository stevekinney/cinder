<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';

  export type ToolbarSeparatorProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../../utilities/class-names.ts';

  let { class: className, ...rest }: ToolbarSeparatorProps = $props();
</script>

<div
  class={classNames('toolbar-separator', className)}
  role="separator"
  aria-orientation="vertical"
  aria-hidden="true"
  {...rest}
></div>

<style>
  .toolbar-separator {
    width: 1px;
    height: 1rem;
    background: var(--cinder-border-muted);
    margin-inline: var(--cinder-space-1);
    flex-shrink: 0;
  }
</style>
