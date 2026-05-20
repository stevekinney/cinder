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
  /** Visible accessible name placed on `aria-label`. Required. */
  label: string;
  /** Prevents interaction when true. Sets `disabled` attribute. */
  disabled?: boolean;
  /** Additional class names merged with `.cinder-toggle`. */
  class?: string;
};
