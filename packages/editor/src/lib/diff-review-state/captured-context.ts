/**
 * Builds the captured context a comment or draft retains independent of whether its target or
 * file is still live (DR-2 normative handoff, "Identity, schema, and validation").
 *
 * @module
 */

import type {
  DiffReviewAnchor,
  DiffReviewCapturedContext,
  DiffReviewRawMapping,
  DiffReviewTargetRecord,
} from './types.js';

function computeRawMapping(anchor: DiffReviewAnchor): DiffReviewRawMapping {
  if (anchor.kind === 'file') return { status: 'exact' };
  return anchor.coordinateSpace === 'normalized-markdown'
    ? { status: 'unavailable', reason: 'normalization' }
    : { status: 'exact' };
}

export function buildDiffReviewCapturedContext(
  target: DiffReviewTargetRecord,
  anchor: DiffReviewAnchor,
  paths: { oldPath?: string | null | undefined; newPath?: string | null | undefined } = {},
): DiffReviewCapturedContext {
  return {
    targetKind: target.kind,
    targetLabel: target.label,
    repositoryLabel: target.repositoryLabel,
    baseRevisionLabel: target.baseRevisionLabel,
    headRevisionLabel: target.headRevisionLabel,
    oldPath: paths.oldPath ?? null,
    newPath: paths.newPath ?? null,
    fileOccurrence: anchor.fileOccurrence,
    snapshotId: target.snapshotId,
    rawMapping: computeRawMapping(anchor),
  };
}
