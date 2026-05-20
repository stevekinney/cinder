<script lang="ts" module>
  export type { ToggleProps } from './toggle.types.ts';
</script>

<script lang="ts">
  import type { ToggleProps } from './toggle.types.ts';
  import { cn } from '../../utilities/class-names.ts';

  let {
    id,
    checked = $bindable(false),
    label,
    disabled = false,
    class: customClassName,
  }: ToggleProps = $props();

  function toggle(): void {
    if (!disabled) {
      checked = !checked;
    }
  }
</script>

<button
  {id}
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  onclick={toggle}
  class={cn('cinder-toggle', customClassName)}
  data-cinder-checked={checked ? '' : undefined}
>
  <span aria-hidden="true" class="cinder-toggle__thumb"></span>
</button>
