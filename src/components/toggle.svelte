<script lang="ts" module>
  /** Props for the Toggle component (toggle-button pattern, not role="switch"). */
  export type ToggleProps = {
    /** Native id placed on the `<button>` so an external `<label for="…">` can reference it. */
    id: string;
    /** Whether the toggle is currently pressed. Bindable — defaults to false. */
    pressed: boolean;
    /** Visible accessible name placed on `aria-label`. Required. */
    label: string;
    /** Prevents interaction when true. Sets `disabled` attribute and `aria-disabled`. */
    disabled?: boolean;
    /** Additional class names merged with `.cinder-toggle`. */
    class?: string;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  let {
    id,
    pressed = $bindable(false),
    label,
    disabled = false,
    class: customClassName,
  }: ToggleProps = $props();

  function toggle(): void {
    if (!disabled) {
      pressed = !pressed;
    }
  }
</script>

<button
  {id}
  type="button"
  aria-pressed={pressed}
  aria-label={label}
  aria-disabled={disabled ? true : undefined}
  {disabled}
  onclick={toggle}
  class={cn('cinder-toggle', customClassName)}
  data-cinder-pressed={pressed ? '' : undefined}
>
  <span aria-hidden="true" class="cinder-toggle__thumb"></span>
</button>
