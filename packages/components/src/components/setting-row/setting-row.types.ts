import type { Snippet } from 'svelte';
import type { FormFieldManaged } from '../form-field/form-field.types.ts';
export type SettingRowProps = {
  /**
   * Stable id forwarded into `FormField` context, which associates the
   * generated `<label for={id}>` with it. Only a control that opts into
   * and reads that context receives `id` automatically—for a native
   * element or a third-party component that doesn't, the label is
   * unassociated unless the host also applies `id` to that control
   * directly, the same qualification as `required` and `disabled`.
   */
  id: string;
  /** Visible setting label. */
  label: string;
  /** Guidance text describing the setting. */
  description?: string;
  /**
   * Advisory message. `FormField` renders this text itself, as a sibling
   * of the control, not through context—a custom `control` that reads
   * `FormField` context sees only the derived `warningId` (and the
   * composed `describedBy`) to associate with, never the message string
   * itself.
   */
  warning?: string;
  /**
   * Corrective error message. `FormField` renders this text itself, as a
   * sibling of the control, not through context—a custom `control` that
   * reads `FormField` context sees only the derived `errorId`, `invalid`,
   * and the composed `describedBy`, never the message string itself.
   */
  error?: string;
  /**
   * Renders the required marker and forwards `required` into `FormField`
   * context. Only takes effect for a control that opts into and reads that
   * context—it never adds a native `required` attribute, so a control that
   * doesn't consume the context still passes browser constraint validation
   * and must receive `required` directly. `SettingRow` forwards `undefined`
   * when omitted; `FormField` normalizes that to `false`. Defaults to
   * `false`.
   * @default false
   */
  required?: boolean;
  /**
   * Forwards a disabled state into `FormField` context for the row's
   * control. Only takes effect for a control that opts into and reads that
   * context—a native element or a third-party component that doesn't
   * consume it stays interactive and must receive `disabled` directly.
   * Does not disable automatically while saving. `SettingRow` forwards
   * `undefined` when omitted; `FormField` normalizes that to `false`.
   * Defaults to `false`.
   * @default false
   */
  disabled?: boolean;
  /** Renders a managed-policy indicator; pair with `PolicyLock`. */
  managed?: FormFieldManaged;
  /** The setting's control, rendered with `FormField` context applied. */
  control: Snippet;
  /** Optional disclosure content rendered beneath the row. */
  disclosure?: Snippet;
  /** Additional class merged with the component's root class. */
  class?: string;
};
