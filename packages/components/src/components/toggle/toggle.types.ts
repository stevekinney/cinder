/**
 * Props for the Toggle component.
 *
 * Uses the WAI-ARIA switch pattern (`role="switch"` + `aria-checked`) — the
 * visible UI is a sliding-thumb pill, so the accessible role must match what
 * sighted users see. Use Toggle for "this thing is on / off" affordances
 * (notifications enabled, dark mode, etc.). For a toggle button that
 * changes the state of something else without representing a binary
 * on/off (e.g. bold formatting), use Button with `aria-pressed`.
 *
 * The component renders its own label next to the switch, so consumers do not
 * hand-roll an external one. `label` is always the accessible name (wired via
 * `aria-labelledby`); `hideLabel` changes only the visual presentation and
 * never removes the accessible name.
 */
export type ToggleProps = {
  /** Native id placed on the `<button>`; the rendered label uses `aria-labelledby` to name it (label id is derived as `${id}-label`). */
  id: string;
  /** Whether the toggle is currently checked. Bindable — defaults to false. */
  checked?: boolean;
  /** Visible label text. Always the accessible name, even when `hideLabel` is set. Required. */
  label: string;
  /** Prevents interaction when true. Sets `disabled` attribute. */
  disabled?: boolean;
  /** Visually hide the rendered label while keeping it as the accessible name. Use for icon-only or inline contexts. */
  hideLabel?: boolean;
  /** Additional class names merged with `.cinder-toggle` on the switch button. */
  class?: string;
};
