import type { ComponentAttributes } from '../../_internal/constraints.ts';

/**
 * Valid attribute sets for the Input component.
 * Each must produce zero violations.
 */
export const valid: ComponentAttributes[] = [
  // Basic labeled text input
  { id: 'name', label: 'Full name', value: '' },

  // Password with correct autocomplete
  {
    id: 'password',
    label: 'Password',
    type: 'password',
    autocomplete: 'current-password',
    value: '',
  },

  // New-account password
  {
    id: 'new-pw',
    label: 'New password',
    type: 'password',
    autocomplete: 'new-password',
    value: '',
  },

  // Email input — not password, so autocomplete warning does not apply
  { id: 'email', label: 'Email address', type: 'email', value: '' },

  // Text input with description and error
  { id: 'bio', label: 'Bio', description: 'A short bio.', error: '', value: '' },
];

/**
 * Invalid attribute sets for the Input component.
 */
export const invalid: Array<{ attributes: ComponentAttributes; violates: string }> = [
  // violates: accessible-name — no label provided
  {
    attributes: { id: 'name', value: '' },
    violates: 'accessible-name',
  },

  // violates: accessible-name — empty label
  {
    attributes: { id: 'name', label: '', value: '' },
    violates: 'accessible-name',
  },

  // violates: password-autocomplete — password without autocomplete
  {
    attributes: { id: 'pw', label: 'Password', type: 'password', value: '' },
    violates: 'password-autocomplete',
  },

  // violates: password-autocomplete — password with empty autocomplete
  {
    attributes: { id: 'pw', label: 'Password', type: 'password', autocomplete: '', value: '' },
    violates: 'password-autocomplete',
  },
];
