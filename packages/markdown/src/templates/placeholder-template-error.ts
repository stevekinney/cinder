/**
 * The typed error thrown by strict (`unresolved: 'error'`) placeholder
 * resolution. `PlaceholderTemplateError` is re-exported by
 * `template-placeholders.ts`.
 *
 * @module
 */

import type { PlaceholderDiagnostic } from './types.js';

/**
 * Thrown when strict placeholder resolution finds any issue.
 *
 * It carries the same ordered diagnostics preserve mode would return and
 * nothing else: no supplied values and no partial text or HTML.
 */
export class PlaceholderTemplateError extends Error {
  /** Ordered, deduplicated diagnostics; never includes supplied values. */
  readonly issues: readonly PlaceholderDiagnostic[];

  constructor(issues: readonly PlaceholderDiagnostic[]) {
    const codes = [...new Set(issues.map((issue) => issue.code))].join(', ');
    super(`Template placeholders could not be resolved (${issues.length} issue(s): ${codes}).`);
    this.name = 'PlaceholderTemplateError';
    this.issues = Object.freeze([...issues]);
  }
}
