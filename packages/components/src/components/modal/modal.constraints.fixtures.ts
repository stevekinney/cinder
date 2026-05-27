import type { ComponentAttributes } from '../../_internal/constraints.ts';

/**
 * Valid attribute sets for the Modal component.
 * Each must produce zero violations.
 */
export const valid: ComponentAttributes[] = [
  // Basic modal with title
  { title: 'Confirm deletion', open: true, children: true },

  // Modal with describedById pointing at a summary paragraph
  { title: 'Settings', open: true, children: true, describedById: 'settings-desc' },

  // Modal without describedById (omitting the prop entirely is fine)
  { title: 'Upload file', open: true, children: true },

  // Modal with all props
  { title: 'Edit profile', open: false, children: true, footer: true, describedById: 'edit-desc' },

  // role="alertdialog" with a description source
  {
    title: 'Session expired',
    role: 'alertdialog',
    open: true,
    children: true,
    describedById: 'session-desc',
  },
];

/**
 * Invalid attribute sets for the Modal component.
 */
export const invalid: Array<{ attributes: ComponentAttributes; violates: string }> = [
  // violates: accessible-title — empty title string
  {
    attributes: { title: '', open: true, children: true },
    violates: 'accessible-title',
  },

  // violates: described-by-non-empty — empty string for describedById
  {
    attributes: { title: 'Settings', open: true, children: true, describedById: '' },
    violates: 'described-by-non-empty',
  },

  // violates: accessible-title — title is missing
  {
    attributes: { open: true, children: true },
    violates: 'accessible-title',
  },

  // violates: alertdialog-description — alertdialog role requires describedById
  {
    attributes: { title: 'Session expired', role: 'alertdialog', open: true, children: true },
    violates: 'alertdialog-description',
  },
];
