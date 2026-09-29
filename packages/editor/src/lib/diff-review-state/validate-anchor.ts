/**
 * Anchor shape validation (DR-2 normative handoff, "Identity, schema, and validation" and
 * "Viewer selection and navigation").
 *
 * A file anchor has no line range. A range anchor additionally requires a nonnegative hunk
 * occurrence, a side, a positive inclusive one-based line range, a coordinate space, and a
 * selected-text excerpt — which may legitimately be the empty string, since an empty source line
 * with a valid line number is selectable. At most three same-side context lines are ever
 * captured on either side.
 *
 * @module
 */

import type { DiffReviewAnchor, DiffReviewResult } from './types.js';

const MAX_CONTEXT_LINES = 3;

const FILE_ANCHOR_KEYS = ['kind', 'fileOccurrence'];
const RANGE_ANCHOR_KEYS = [
  'kind',
  'fileOccurrence',
  'hunkOccurrence',
  'side',
  'startLine',
  'endLine',
  'coordinateSpace',
  'selectedText',
  'contextBefore',
  'contextAfter',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Unknown object keys are rejected in versioned snapshots (and, for simplicity, live actions). */
function findUnknownKey(
  input: Record<string, unknown>,
  allowed: readonly string[],
): string | undefined {
  return Object.keys(input).find((key) => !allowed.includes(key));
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isStringArrayWithinLimit(value: unknown, limit: number): value is string[] {
  return Array.isArray(value) && value.length <= limit && value.every((v) => typeof v === 'string');
}

function invalidResult(path: string, message: string): DiffReviewResult<DiffReviewAnchor> {
  return { ok: false, error: { code: 'invalid-anchor', path, message } };
}

function validateFileAnchor(
  input: Record<string, unknown>,
  path: string,
): DiffReviewResult<DiffReviewAnchor> {
  const unknownKey = findUnknownKey(input, FILE_ANCHOR_KEYS);
  if (unknownKey) return invalidResult(`${path}/${unknownKey}`, `Unknown key '${unknownKey}'.`);

  const fileOccurrence = input['fileOccurrence'];
  if (!isNonnegativeInteger(fileOccurrence)) {
    return invalidResult(`${path}/fileOccurrence`, 'fileOccurrence must be a nonnegative integer.');
  }
  return { ok: true, value: { kind: 'file', fileOccurrence } };
}

function validateRangeAnchor(
  input: Record<string, unknown>,
  path: string,
): DiffReviewResult<DiffReviewAnchor> {
  const unknownKey = findUnknownKey(input, RANGE_ANCHOR_KEYS);
  if (unknownKey) return invalidResult(`${path}/${unknownKey}`, `Unknown key '${unknownKey}'.`);

  const fileOccurrence = input['fileOccurrence'];
  if (!isNonnegativeInteger(fileOccurrence)) {
    return invalidResult(`${path}/fileOccurrence`, 'fileOccurrence must be a nonnegative integer.');
  }
  const hunkOccurrence = input['hunkOccurrence'];
  if (!isNonnegativeInteger(hunkOccurrence)) {
    return invalidResult(`${path}/hunkOccurrence`, 'hunkOccurrence must be a nonnegative integer.');
  }
  const side = input['side'];
  if (side !== 'old' && side !== 'new') {
    return invalidResult(`${path}/side`, "side must be 'old' or 'new'.");
  }
  const startLine = input['startLine'];
  if (typeof startLine !== 'number' || !Number.isInteger(startLine) || startLine < 1) {
    return invalidResult(`${path}/startLine`, 'startLine must be a positive one-based integer.');
  }
  const endLine = input['endLine'];
  if (typeof endLine !== 'number' || !Number.isInteger(endLine) || endLine < startLine) {
    return invalidResult(`${path}/endLine`, 'endLine must be an integer >= startLine.');
  }
  const coordinateSpace = input['coordinateSpace'];
  if (coordinateSpace !== 'raw-source' && coordinateSpace !== 'normalized-markdown') {
    return invalidResult(
      `${path}/coordinateSpace`,
      "coordinateSpace must be 'raw-source' or 'normalized-markdown'.",
    );
  }
  const selectedText = input['selectedText'];
  if (typeof selectedText !== 'string') {
    return invalidResult(`${path}/selectedText`, 'selectedText must be a string (may be empty).');
  }
  const contextBefore = input['contextBefore'];
  if (!isStringArrayWithinLimit(contextBefore, MAX_CONTEXT_LINES)) {
    return invalidResult(
      `${path}/contextBefore`,
      `contextBefore must be an array of at most ${MAX_CONTEXT_LINES} strings.`,
    );
  }
  const contextAfter = input['contextAfter'];
  if (!isStringArrayWithinLimit(contextAfter, MAX_CONTEXT_LINES)) {
    return invalidResult(
      `${path}/contextAfter`,
      `contextAfter must be an array of at most ${MAX_CONTEXT_LINES} strings.`,
    );
  }
  return {
    ok: true,
    value: {
      kind: 'range',
      fileOccurrence,
      hunkOccurrence,
      side,
      startLine,
      endLine,
      coordinateSpace,
      selectedText,
      contextBefore,
      contextAfter,
    },
  };
}

/** Validates an anchor's shape at `path`. Never inspects live target/file content. */
export function validateDiffReviewAnchor(
  anchor: unknown,
  path: string,
): DiffReviewResult<DiffReviewAnchor> {
  if (!isRecord(anchor)) {
    return invalidResult(path, 'An anchor must be an object.');
  }

  if (anchor['kind'] !== 'file' && anchor['kind'] !== 'range') {
    return invalidResult(`${path}/kind`, "kind must be 'file' or 'range'.");
  }

  return anchor['kind'] === 'file'
    ? validateFileAnchor(anchor, path)
    : validateRangeAnchor(anchor, path);
}
