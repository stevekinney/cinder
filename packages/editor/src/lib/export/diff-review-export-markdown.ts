/**
 * Renders a `DiffReviewExportModel` into the Markdown agent handoff (DR-5, "Agent export
 * contract" and "Export literalness and existing threads").
 *
 * @module
 */

import { literalFencedBlock } from './diff-review-export-fence.js';
import type {
  DiffReviewExportDiffRecord,
  DiffReviewExportDocumentRecord,
  DiffReviewExportModel,
} from './diff-review-export-types.js';

const PREAMBLE =
  'Address open comments. Resolved comments are historical context. ' +
  'Verify outdated locations against current content before acting.';

/** Up to two available context lines are quoted on each side, per the contract — the exported
 * anchor may retain up to three, captured for a margin the export intentionally trims from. */
const QUOTED_CONTEXT_LINES = 2;

/** Derives the two-line-trimmed quoted excerpt from a range record's own anchor context, so
 * Markdown never carries a second, independently-maintained copy of the quote. */
function quoteFor(record: DiffReviewExportDiffRecord): string | null {
  if (record.anchor.kind === 'file') return null;
  const { contextBefore, contextAfter, selectedText } = record.anchor;
  const before = contextBefore.slice(-QUOTED_CONTEXT_LINES);
  const after = contextAfter.slice(0, QUOTED_CONTEXT_LINES);
  return [...before, selectedText, ...after].join('\n');
}

function scopeLine(scope: DiffReviewExportModel['scope']): string {
  return scope === 'unresolved' ? 'Scope: unresolved only' : 'Scope: all saved comments';
}

function totalsLine(totals: DiffReviewExportModel['totals']): string {
  return (
    `Records: ${totals.records}; message bodies: ${totals.messageBodies}; ` +
    `open: ${totals.open}; resolved: ${totals.resolved}; outdated: ${totals.outdated}`
  );
}

function locationLine(record: DiffReviewExportDiffRecord): string {
  if (record.anchor.kind === 'file') return 'Location: file comment';
  const { side, startLine, endLine, coordinateSpace } = record.anchor;
  const range = startLine === endLine ? `line ${startLine}` : `lines ${startLine}–${endLine}`;
  return `Location: ${side} side, ${coordinateSpace} ${range}`;
}

function stateLine(record: DiffReviewExportDiffRecord): string {
  const resolution = record.resolved ? 'resolved' : 'open';
  const currency = record.outdated ? 'outdated (verification needed)' : 'current';
  return `State: ${resolution}, ${currency}`;
}

function pathLine(record: DiffReviewExportDiffRecord): string {
  return `File: old=${record.oldPath ?? '(none)'}, new=${record.newPath ?? '(none)'}`;
}

function revisionLine(record: DiffReviewExportDiffRecord): string | null {
  if (record.baseRevisionLabel === null && record.headRevisionLabel === null) return null;
  if (record.baseRevisionLabel !== null && record.headRevisionLabel !== null) {
    return `Revision: ${record.baseRevisionLabel} → ${record.headRevisionLabel}`;
  }
  return `Revision: ${record.baseRevisionLabel ?? record.headRevisionLabel}`;
}

function renderDiffRecord(record: DiffReviewExportDiffRecord): string {
  const lines: string[] = [`### Comment ${record.commentId}`, ''];
  lines.push(stateLine(record));
  lines.push(`Snapshot: ${record.snapshotId}`);
  lines.push(`ID: ${record.exportId}`);
  lines.push(pathLine(record));
  const revision = revisionLine(record);
  if (revision !== null) lines.push(revision);
  if (record.repositoryLabel !== null) lines.push(`Repository: ${record.repositoryLabel}`);
  lines.push(locationLine(record));
  lines.push('');

  const quoted = quoteFor(record);
  if (quoted !== null) {
    lines.push('Quoted source:', '', literalFencedBlock(quoted), '');
  }

  lines.push('Feedback:', '', literalFencedBlock(record.body));

  return lines.join('\n');
}

function targetHeading(record: DiffReviewExportDiffRecord): string {
  const prefix = record.current ? 'Target' : 'Removed target';
  return `## ${prefix} ${record.targetId}: ${record.targetLabel}`;
}

function renderDiffSection(diffRecords: DiffReviewExportDiffRecord[]): string[] {
  const blocks: string[] = [];
  let lastTargetId: string | null = null;

  for (const record of diffRecords) {
    if (record.targetId !== lastTargetId) {
      blocks.push(targetHeading(record));
      lastTargetId = record.targetId;
    }
    blocks.push(renderDiffRecord(record));
  }

  return blocks;
}

function documentLocationLine(record: DiffReviewExportDocumentRecord): string {
  return record.anchor.kind === 'document-text'
    ? 'Location: document-text'
    : 'Location: document comment';
}

function renderDocumentRecord(record: DiffReviewExportDocumentRecord): string {
  const lines: string[] = [
    `### Document thread ${record.threadId} (${record.targetId})`,
    '',
    `Created: ${record.createdAt}`,
    `ID: ${record.exportId}`,
    documentLocationLine(record),
    '',
  ];

  if (record.anchor.kind === 'document-text') {
    lines.push('Quoted document text:', '', literalFencedBlock(record.anchor.quote), '');
  }

  for (const message of record.messages) {
    lines.push(`#### Message ${message.id}`, '');
    lines.push(`Created: ${message.createdAt}`, '');
    lines.push(literalFencedBlock(message.body), '');
  }

  // Trailing blank line above is redundant with the join below; trim it so sections don't
  // accumulate blank lines when concatenated.
  while (lines[lines.length - 1] === '') lines.pop();

  return lines.join('\n');
}

function renderDocumentSection(documentRecords: DiffReviewExportDocumentRecord[]): string[] {
  if (documentRecords.length === 0) return [];
  return ['## Existing document comments', ...documentRecords.map(renderDocumentRecord)];
}

/**
 * Every element of `blocks` is one logical unit of Markdown (a heading, a preamble sentence, a
 * whole comment record — internally joined with single newlines where it has structure of its
 * own). Blocks are separated from each other by exactly one blank line, and never by manually
 * pushed empty-string elements, so the join step is the single place blank-line spacing is
 * decided.
 */
function joinBlocks(blocks: string[]): string {
  return `${blocks.join('\n\n')}\n`;
}

export function renderDiffReviewMarkdown(model: DiffReviewExportModel): string {
  const diffRecords = model.records.filter(
    (record): record is DiffReviewExportDiffRecord => record.recordKind === 'diff',
  );
  const documentRecords = model.records.filter(
    (record): record is DiffReviewExportDocumentRecord => record.recordKind === 'document',
  );

  const blocks: string[] = [`# ${model.reviewTitle}`, PREAMBLE];

  if (model.reviewNote.trim().length > 0) {
    blocks.push(`## Review note\n\n${literalFencedBlock(model.reviewNote)}`);
  }

  blocks.push(`${scopeLine(model.scope)}\n${totalsLine(model.totals)}`);
  blocks.push(...renderDiffSection(diffRecords));
  blocks.push(...renderDocumentSection(documentRecords));

  return joinBlocks(blocks);
}
