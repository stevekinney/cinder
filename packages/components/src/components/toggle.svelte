<script lang="ts" module>
  /**
   * Props for the Toggle component.
   *
   * Uses the WAI-ARIA switch pattern (`role="switch"` + `aria-checked`) — the
   * visible UI is a sliding-thumb pill, so the accessible role must match what
   * sighted users see. Use Toggle for "this thing is on / off" affordances
   * (notifications enabled, dark mode, etc.). For a toggle button that
   * changes the state of something else without representing a binary
   * on/off (e.g. bold formatting), use Button with `aria-pressed`.
   */
  export type ToggleProps = {
    /** Native id placed on the `<button>` so an external `<label for="…">` can reference it. */
    id: string;
    /** Whether the toggle is currently checked. Bindable — defaults to false. */
    checked?: boolean;
    /**
     * @deprecated Use `checked`. Preserved so existing consumers using the former
     * toggle-button API keep controlling the same on/off state.
     */
    pressed?: boolean;
    /** Visible accessible name placed on `aria-label`. Required. */
    label: string;
    /** Prevents interaction when true. Sets `disabled` attribute. */
    disabled?: boolean;
    /** Additional class names merged with `.cinder-toggle`. */
    class?: string;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  let {
    id,
    checked = $bindable<boolean | undefined>(undefined),
    pressed = $bindable<boolean | undefined>(undefined),
    label,
    disabled = false,
    class: customClassName,
  }: ToggleProps = $props();

  const isChecked = $derived(checked ?? pressed ?? false);

  function toggle(): void {
    if (!disabled) {
      const nextChecked = !isChecked;
      checked = nextChecked;
      pressed = nextChecked;
    }
  }
</script>

<button
  {id}
  type="button"
  role="switch"
  aria-checked={isChecked}
  aria-label={label}
  {disabled}
  onclick={toggle}
  class={cn('cinder-toggle', customClassName)}
  data-cinder-checked={isChecked ? '' : undefined}
>
  <span aria-hidden="true" class="cinder-toggle__thumb"></span>
</button>
