/**
 * Serializes a `DiffReviewExportModel` to the versioned JSON agent handoff (DR-5, "Agent export
 * contract").
 *
 * @module
 */

import type { DiffReviewExportModel } from './diff-review-export-types.js';

/** Two-space indentation and exactly one trailing newline, per the contract. */
export function renderDiffReviewJson(model: DiffReviewExportModel): string {
  return `${JSON.stringify(model, null, 2)}\n`;
}
