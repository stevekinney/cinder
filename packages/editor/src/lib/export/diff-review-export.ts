/**
 * `exportDiffReviewMarkdown` and `exportDiffReviewJson` — the pure, DOM-free agent handoff
 * exporters for a `DiffReviewState` (DR-5, "Agent export contract"). Public at the existing
 * `@lostgradient/editor/export` subpath, alongside the ReviewEditor's older comment/diff
 * exporters.
 *
 * Both functions build the same `DiffReviewExportModel` (see `diff-review-export-model.ts`) and
 * only differ in how they render it, so Markdown and JSON agree on IDs, bodies, location, and
 * state by construction. Export never modifies comment resolution or reviewed state, never reads
 * a clock, and produces byte-identical output for identical input and options.
 *
 * @module
 */

import type { DiffReviewResult, DiffReviewState } from '../diff-review-state/index.js';
import { renderDiffReviewJson } from './diff-review-export-json.js';
import { renderDiffReviewMarkdown } from './diff-review-export-markdown.js';
import { buildDiffReviewExportModel } from './diff-review-export-model.js';
import type { DiffReviewExportOptions } from './diff-review-export-types.js';

export function exportDiffReviewMarkdown(
  state: DiffReviewState,
  options: DiffReviewExportOptions = {},
): DiffReviewResult<string> {
  const model = buildDiffReviewExportModel(state, options);
  if (!model.ok) return model;
  return { ok: true, value: renderDiffReviewMarkdown(model.value) };
}

export function exportDiffReviewJson(
  state: DiffReviewState,
  options: DiffReviewExportOptions = {},
): DiffReviewResult<string> {
  const model = buildDiffReviewExportModel(state, options);
  if (!model.ok) return model;
  return { ok: true, value: renderDiffReviewJson(model.value) };
}
