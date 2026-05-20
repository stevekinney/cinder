import type { ComponentAttributes } from '../../_internal/constraints.ts';

/**
 * Valid attribute sets for the Button component.
 *
 * Each set must produce zero violations from `button.constraints.ts`.
 * Note: `iconOnly` is normalized to `false` for the default case since the
 * evaluator uses strict equality and the constraint rule requires `equals: false`.
 */
export const valid: ComponentAttributes[] = [
  // Branch 1: visible label, iconOnly explicitly false (default)
  { label: 'Save', iconOnly: false },
  { label: 'Delete', iconOnly: false, variant: 'danger' },
  { label: 'Submit', iconOnly: false, loading: true },

  // Branch 2: children snippet, iconOnly explicitly false
  { children: true, iconOnly: false },
  { children: true, iconOnly: false, variant: 'primary' },

  // Branch 3a: icon-only with leadingIcon and label as accessible name
  { iconOnly: true, label: 'Close', leadingIcon: true },

  // Branch 3b: icon-only with trailingIcon and aria-label
  { iconOnly: true, 'aria-label': 'Settings', trailingIcon: true },

  // Branch 3c: icon-only with children as visual and aria-labelledby
  { iconOnly: true, 'aria-labelledby': 'btn-label', children: true },

  // Branch 3d: icon-only with both leadingIcon and label
  { iconOnly: true, label: 'Open menu', leadingIcon: true, trailingIcon: true },
];

/**
 * Invalid attribute sets for the Button component, each annotated with the
 * rule id that the evaluator should include in its violations.
 *
 * The evaluator may return additional violations; tests assert containment only.
 */
export const invalid: Array<{ attributes: ComponentAttributes; violates: string }> = [
  // violates: accessible-name — icon-only with no name source
  {
    attributes: { iconOnly: true, leadingIcon: true },
    violates: 'accessible-name',
  },

  // violates: accessible-name — icon-only children as visual but no name
  {
    attributes: { iconOnly: true, children: true },
    violates: 'accessible-name',
  },

  // violates: visual-content-source — both label and children simultaneously (iconOnly false)
  // This is two visual content sources at once.
  {
    attributes: { label: 'Save', children: true, iconOnly: false },
    violates: 'visual-content-source',
  },

  // violates: visual-content-source — no content at all
  {
    attributes: { iconOnly: false },
    violates: 'visual-content-source',
  },

  // violates: visual-content-source — iconOnly true but no visual icon
  // (accessible-name may also fire if no name is present)
  {
    attributes: { iconOnly: true, label: 'Close' },
    violates: 'visual-content-source',
  },
];
