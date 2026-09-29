import type { HTMLAttributes } from 'svelte/elements';
export type ShortcutFieldProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'children' | 'role'
> & {
  /**
   * Ordered list of platform key names for the recorded combination.
   * Bindable—the component writes to it directly after a valid capture and
   * on clear, so `bind:value` is the supported alternative to mirroring
   * `onValueChange` yourself. Defaults to `[]`.
   * @default []
   */
  value?: string[];
  /**
   * Called with the recorded combination when capture completes, and also
   * called with an empty array when the user clears the field—handle the
   * empty-array case to persist a removal, not only a successful capture.
   */
  onValueChange?: (value: string[]) => void;
  /**
   * Returns an error message for a combination the application cannot
   * accept; the field keeps the previous value until a valid replacement
   * is committed. Only checked on a keyboard capture—clearing the field
   * bypasses it entirely, so a shortcut this rejects as required can still
   * be removed via the clear action.
   */
  validate?: (value: string[]) => string | undefined;
  /**
   * Accessible label for the shortcut field. Defaults to `'Keyboard
   * shortcut'`. Rendered as visible field text by default (see
   * `labelVisible`).
   * @default 'Keyboard shortcut'
   */
  label?: string;
  /**
   * Whether `label` renders as visible field text. When `false`, the label
   * remains in the DOM (associated via `aria-labelledby`) but is visually
   * hidden with the shared `cinder-sr-only` treatment. Defaults to `true`,
   * matching the field-control contract used by `FormField`, `Input`, and
   * `PhoneInput`.
   * @default true
   */
  labelVisible?: boolean;
  /** Set when the shortcut is unavailable. Defaults to `false`. @default false */
  disabled?: boolean;
  /** Additional class merged with the component's root class. */
  class?: string;
};
