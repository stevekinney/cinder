/**
 * Full schema validation for a serialized `DiffReviewState`, as accepted by
 * `restoreDiffReviewState` (DR-2 normative handoff, "Identity, schema, and validation").
 *
 * Validation returns the first error in schema-field order, then array order, with a JSON
 * Pointer path. Unknown object keys are rejected everywhere in the snapshot. A comment or draft
 * whose target is no longer supplied is only valid with a fully well-formed captured context —
 * a malformed captured context on an absent target fails with `missing-context` rather than the
 * generic `invalid-record`, since there is nothing live to fall back on.
 *
 * Every validator below returns a `DiffReviewResult`, narrowing field-by-field and building its
 * typed value from those narrowed accesses, rather than asserting a whole object's shape with a
 * type cast.
 *
 * @module
 */

import { isCanonicalDiffReviewTimestamp } from './clock.js';
import type {
  DiffReviewCapturedContext,
  DiffReviewComment,
  DiffReviewDraft,
  DiffReviewError,
  DiffReviewErrorCode,
  DiffReviewRawMapping,
  DiffReviewResult,
  DiffReviewReviewedMarker,
  DiffReviewState,
  DiffReviewTargetKind,
  DiffReviewTargetRecord,
} from './types.js';
import { DIFF_REVIEW_STATE_VERSION } from './types.js';
import { validateDiffReviewAnchor } from './validate-anchor.js';

const STATE_KEYS = [
  'version',
  'targets',
  'comments',
  'drafts',
  'reviewNote',
  'selectedTargetId',
  'selectedFileOccurrence',
  'reviewedMarkers',
];
const TARGET_RECORD_KEYS = [
  'targetId',
  'kind',
  'label',
  'repositoryLabel',
  'baseRevisionLabel',
  'headRevisionLabel',
  'snapshotId',
];
const COMMENT_KEYS = [
  'id',
  'targetId',
  'snapshotId',
  'anchor',
  'capturedContext',
  'body',
  'createdAt',
  'updatedAt',
  'resolved',
  'outdated',
];
const DRAFT_KEYS = [
  'draftId',
  'targetId',
  'anchor',
  'capturedContext',
  'body',
  'createdAt',
  'updatedAt',
  'outdated',
];
const REVIEWED_MARKER_KEYS = ['targetId', 'snapshotId', 'fileOccurrence'];
const CAPTURED_CONTEXT_KEYS = [
  'targetKind',
  'targetLabel',
  'repositoryLabel',
  'baseRevisionLabel',
  'headRevisionLabel',
  'oldPath',
  'newPath',
  'fileOccurrence',
  'snapshotId',
  'rawMapping',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isTargetKind(value: unknown): value is DiffReviewTargetKind {
  return value === 'source' || value === 'markdown';
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function fail<T>(code: DiffReviewErrorCode, path: string, message: string): DiffReviewResult<T> {
  return { ok: false, error: { code, path, message } };
}

function checkUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  code: DiffReviewErrorCode = 'invalid-record',
): DiffReviewError | undefined {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key))
      return { code, path: `${path}/${key}`, message: `Unknown key '${key}'.` };
  }
  return undefined;
}

function validateRawMapping(
  value: unknown,
  path: string,
  code: DiffReviewErrorCode,
): DiffReviewResult<DiffReviewRawMapping> {
  if (!isRecord(value)) return fail(code, path, 'rawMapping must be an object.');
  if (value['status'] === 'exact') {
    const unknown = checkUnknownKeys(value, ['status'], path, code);
    if (unknown) return { ok: false, error: unknown };
    return { ok: true, value: { status: 'exact' } };
  }
  if (value['status'] === 'unavailable') {
    const unknown = checkUnknownKeys(value, ['status', 'reason'], path, code);
    if (unknown) return { ok: false, error: unknown };
    if (value['reason'] !== 'normalization') {
      return fail(code, `${path}/reason`, "reason must be 'normalization'.");
    }
    return { ok: true, value: { status: 'unavailable', reason: 'normalization' } };
  }
  return fail(code, `${path}/status`, "status must be 'exact' or 'unavailable'.");
}

function validateCapturedContext(
  value: unknown,
  path: string,
  targetIsLive: boolean,
): DiffReviewResult<DiffReviewCapturedContext> {
  const code: DiffReviewErrorCode = targetIsLive ? 'invalid-record' : 'missing-context';
  if (!isRecord(value)) return fail(code, path, 'capturedContext must be an object.');

  const unknown = checkUnknownKeys(value, CAPTURED_CONTEXT_KEYS, path, code);
  if (unknown) return { ok: false, error: unknown };

  if (!isTargetKind(value['targetKind'])) {
    return fail(code, `${path}/targetKind`, "targetKind must be 'source' or 'markdown'.");
  }
  if (!isNonEmptyString(value['targetLabel'])) {
    return fail(code, `${path}/targetLabel`, 'targetLabel must be a nonempty string.');
  }
  if (!isOptionalString(value['repositoryLabel'])) {
    return fail(code, `${path}/repositoryLabel`, 'repositoryLabel must be a string.');
  }
  if (!isOptionalString(value['baseRevisionLabel'])) {
    return fail(code, `${path}/baseRevisionLabel`, 'baseRevisionLabel must be a string.');
  }
  if (!isOptionalString(value['headRevisionLabel'])) {
    return fail(code, `${path}/headRevisionLabel`, 'headRevisionLabel must be a string.');
  }
  const oldPath = value['oldPath'];
  if (typeof oldPath !== 'string' && oldPath !== null) {
    return fail(code, `${path}/oldPath`, 'oldPath must be a string or null.');
  }
  const newPath = value['newPath'];
  if (typeof newPath !== 'string' && newPath !== null) {
    return fail(code, `${path}/newPath`, 'newPath must be a string or null.');
  }
  if (!isNonnegativeInteger(value['fileOccurrence'])) {
    return fail(code, `${path}/fileOccurrence`, 'fileOccurrence must be a nonnegative integer.');
  }
  if (!isNonEmptyString(value['snapshotId'])) {
    return fail(code, `${path}/snapshotId`, 'snapshotId must be a nonempty string.');
  }
  const rawMapping = validateRawMapping(value['rawMapping'], `${path}/rawMapping`, code);
  if (!rawMapping.ok) return rawMapping;

  return {
    ok: true,
    value: {
      targetKind: value['targetKind'],
      targetLabel: value['targetLabel'],
      repositoryLabel: value['repositoryLabel'],
      baseRevisionLabel: value['baseRevisionLabel'],
      headRevisionLabel: value['headRevisionLabel'],
      oldPath,
      newPath,
      fileOccurrence: value['fileOccurrence'],
      snapshotId: value['snapshotId'],
      rawMapping: rawMapping.value,
    },
  };
}

function validateTargetRecord(
  value: unknown,
  path: string,
): DiffReviewResult<DiffReviewTargetRecord> {
  if (!isRecord(value)) return fail('invalid-record', path, 'A target record must be an object.');
  const unknown = checkUnknownKeys(value, TARGET_RECORD_KEYS, path);
  if (unknown) return { ok: false, error: unknown };

  if (!isNonEmptyString(value['targetId'])) {
    return fail('invalid-record', `${path}/targetId`, 'targetId must be a nonempty string.');
  }
  if (!isTargetKind(value['kind'])) {
    return fail('invalid-record', `${path}/kind`, "kind must be 'source' or 'markdown'.");
  }
  if (!isNonEmptyString(value['label'])) {
    return fail('invalid-record', `${path}/label`, 'label must be a nonempty string.');
  }
  if (!isOptionalString(value['repositoryLabel'])) {
    return fail('invalid-record', `${path}/repositoryLabel`, 'repositoryLabel must be a string.');
  }
  if (!isOptionalString(value['baseRevisionLabel'])) {
    return fail(
      'invalid-record',
      `${path}/baseRevisionLabel`,
      'baseRevisionLabel must be a string.',
    );
  }
  if (!isOptionalString(value['headRevisionLabel'])) {
    return fail(
      'invalid-record',
      `${path}/headRevisionLabel`,
      'headRevisionLabel must be a string.',
    );
  }
  if (!isNonEmptyString(value['snapshotId'])) {
    return fail('invalid-record', `${path}/snapshotId`, 'snapshotId must be a nonempty string.');
  }

  return {
    ok: true,
    value: {
      targetId: value['targetId'],
      kind: value['kind'],
      label: value['label'],
      repositoryLabel: value['repositoryLabel'],
      baseRevisionLabel: value['baseRevisionLabel'],
      headRevisionLabel: value['headRevisionLabel'],
      snapshotId: value['snapshotId'],
    },
  };
}

function validateTimestampOrder(
  createdAt: string,
  updatedAt: string,
  path: string,
): DiffReviewError | undefined {
  if (!isCanonicalDiffReviewTimestamp(createdAt)) {
    return {
      code: 'invalid-timestamp',
      path: `${path}/createdAt`,
      message: 'createdAt must be a canonical UTC ISO timestamp.',
    };
  }
  if (!isCanonicalDiffReviewTimestamp(updatedAt)) {
    return {
      code: 'invalid-timestamp',
      path: `${path}/updatedAt`,
      message: 'updatedAt must be a canonical UTC ISO timestamp.',
    };
  }
  if (updatedAt < createdAt) {
    return {
      code: 'invalid-timestamp',
      path: `${path}/updatedAt`,
      message: 'updatedAt cannot precede createdAt.',
    };
  }
  return undefined;
}

function validateComment(
  value: unknown,
  path: string,
  liveTargetIds: ReadonlySet<string>,
): DiffReviewResult<DiffReviewComment> {
  if (!isRecord(value)) return fail('invalid-record', path, 'A comment must be an object.');
  const unknown = checkUnknownKeys(value, COMMENT_KEYS, path);
  if (unknown) return { ok: false, error: unknown };

  if (!isNonEmptyString(value['id']))
    return fail('invalid-record', `${path}/id`, 'id must be a nonempty string.');
  if (!isNonEmptyString(value['targetId'])) {
    return fail('invalid-record', `${path}/targetId`, 'targetId must be a nonempty string.');
  }
  if (!isNonEmptyString(value['snapshotId'])) {
    return fail('invalid-record', `${path}/snapshotId`, 'snapshotId must be a nonempty string.');
  }

  const anchorResult = validateDiffReviewAnchor(value['anchor'], `${path}/anchor`);
  if (!anchorResult.ok) return anchorResult;

  const targetIsLive = liveTargetIds.has(value['targetId']);
  const contextResult = validateCapturedContext(
    value['capturedContext'],
    `${path}/capturedContext`,
    targetIsLive,
  );
  if (!contextResult.ok) return contextResult;

  const body = value['body'];
  if (typeof body !== 'string' || body.trim().length === 0) {
    return fail(
      'invalid-record',
      `${path}/body`,
      'body must be a nonempty, non-whitespace string.',
    );
  }
  const createdAt = value['createdAt'];
  const updatedAt = value['updatedAt'];
  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string') {
    return fail('invalid-timestamp', `${path}/createdAt`, 'createdAt/updatedAt must be strings.');
  }
  const timestampError = validateTimestampOrder(createdAt, updatedAt, path);
  if (timestampError) return { ok: false, error: timestampError };

  if (typeof value['resolved'] !== 'boolean') {
    return fail('invalid-record', `${path}/resolved`, 'resolved must be a boolean.');
  }
  if (typeof value['outdated'] !== 'boolean') {
    return fail('invalid-record', `${path}/outdated`, 'outdated must be a boolean.');
  }

  return {
    ok: true,
    value: {
      id: value['id'],
      targetId: value['targetId'],
      snapshotId: value['snapshotId'],
      anchor: anchorResult.value,
      capturedContext: contextResult.value,
      body,
      createdAt,
      updatedAt,
      resolved: value['resolved'],
      outdated: value['outdated'],
    },
  };
}

function validateDraft(
  value: unknown,
  path: string,
  liveTargetIds: ReadonlySet<string>,
): DiffReviewResult<DiffReviewDraft> {
  if (!isRecord(value)) return fail('invalid-record', path, 'A draft must be an object.');
  const unknown = checkUnknownKeys(value, DRAFT_KEYS, path);
  if (unknown) return { ok: false, error: unknown };

  if (!isNonEmptyString(value['draftId'])) {
    return fail('invalid-record', `${path}/draftId`, 'draftId must be a nonempty string.');
  }
  if (!isNonEmptyString(value['targetId'])) {
    return fail('invalid-record', `${path}/targetId`, 'targetId must be a nonempty string.');
  }

  const anchorResult = validateDiffReviewAnchor(value['anchor'], `${path}/anchor`);
  if (!anchorResult.ok) return anchorResult;

  const targetIsLive = liveTargetIds.has(value['targetId']);
  const contextResult = validateCapturedContext(
    value['capturedContext'],
    `${path}/capturedContext`,
    targetIsLive,
  );
  if (!contextResult.ok) return contextResult;

  const body = value['body'];
  if (typeof body !== 'string') {
    return fail(
      'invalid-record',
      `${path}/body`,
      'body must be a string (may be empty or whitespace).',
    );
  }
  const createdAt = value['createdAt'];
  const updatedAt = value['updatedAt'];
  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string') {
    return fail('invalid-timestamp', `${path}/createdAt`, 'createdAt/updatedAt must be strings.');
  }
  const timestampError = validateTimestampOrder(createdAt, updatedAt, path);
  if (timestampError) return { ok: false, error: timestampError };

  if (typeof value['outdated'] !== 'boolean') {
    return fail('invalid-record', `${path}/outdated`, 'outdated must be a boolean.');
  }

  return {
    ok: true,
    value: {
      draftId: value['draftId'],
      targetId: value['targetId'],
      anchor: anchorResult.value,
      capturedContext: contextResult.value,
      body,
      createdAt,
      updatedAt,
      outdated: value['outdated'],
    },
  };
}

function validateReviewedMarker(
  value: unknown,
  path: string,
): DiffReviewResult<DiffReviewReviewedMarker> {
  if (!isRecord(value)) return fail('invalid-record', path, 'A reviewed marker must be an object.');
  const unknown = checkUnknownKeys(value, REVIEWED_MARKER_KEYS, path);
  if (unknown) return { ok: false, error: unknown };
  if (!isNonEmptyString(value['targetId'])) {
    return fail('invalid-record', `${path}/targetId`, 'targetId must be a nonempty string.');
  }
  if (!isNonEmptyString(value['snapshotId'])) {
    return fail('invalid-record', `${path}/snapshotId`, 'snapshotId must be a nonempty string.');
  }
  if (!isNonnegativeInteger(value['fileOccurrence'])) {
    return fail(
      'invalid-record',
      `${path}/fileOccurrence`,
      'fileOccurrence must be a nonnegative integer.',
    );
  }
  return {
    ok: true,
    value: {
      targetId: value['targetId'],
      snapshotId: value['snapshotId'],
      fileOccurrence: value['fileOccurrence'],
    },
  };
}

function firstDuplicate<T, K extends keyof T>(
  items: readonly T[],
  key: K,
  arrayPath: string,
): DiffReviewError | undefined {
  const seen = new Set<unknown>();
  for (const [index, item] of items.entries()) {
    const value = item[key];
    if (seen.has(value)) {
      return {
        code: 'duplicate-id',
        path: `${arrayPath}/${index}/${String(key)}`,
        message: `Duplicate ${String(key)} '${String(value)}'.`,
      };
    }
    seen.add(value);
  }
  return undefined;
}

function validateArray<T>(
  data: unknown,
  path: string,
  arrayLabel: string,
  validateOne: (value: unknown, elementPath: string) => DiffReviewResult<T>,
): DiffReviewResult<T[]> {
  if (!Array.isArray(data)) {
    return fail('invalid-record', path, `${arrayLabel} must be an array.`);
  }
  const values: T[] = [];
  for (const [index, element] of data.entries()) {
    const result = validateOne(element, `${path}/${index}`);
    if (!result.ok) return result;
    values.push(result.value);
  }
  return { ok: true, value: values };
}

/**
 * Validates a serialized state completely — every array element, in order — before ever
 * returning `ok: true`. `liveTargetIds` is the set of target IDs the host is currently supplying
 * (used only to decide `invalid-record` vs. `missing-context` for a malformed captured context).
 */
export function validateSerializedDiffReviewState(
  data: unknown,
  liveTargetIds: ReadonlySet<string>,
): DiffReviewResult<DiffReviewState> {
  if (!isRecord(data)) {
    return fail('invalid-record', '', 'A serialized state must be an object.');
  }
  const unknownTop = checkUnknownKeys(data, STATE_KEYS, '');
  if (unknownTop) return { ok: false, error: unknownTop };

  if (data['version'] !== DIFF_REVIEW_STATE_VERSION) {
    return fail(
      'unsupported-version',
      '/version',
      `Unsupported state version '${String(data['version'])}'.`,
    );
  }

  const targets = validateArray(data['targets'], '/targets', 'targets', validateTargetRecord);
  if (!targets.ok) return targets;
  const targetDuplicate = firstDuplicate(targets.value, 'targetId', '/targets');
  if (targetDuplicate) return { ok: false, error: targetDuplicate };

  const comments = validateArray(data['comments'], '/comments', 'comments', (value, elementPath) =>
    validateComment(value, elementPath, liveTargetIds),
  );
  if (!comments.ok) return comments;
  const commentDuplicate = firstDuplicate(comments.value, 'id', '/comments');
  if (commentDuplicate) return { ok: false, error: commentDuplicate };

  const drafts = validateArray(data['drafts'], '/drafts', 'drafts', (value, elementPath) =>
    validateDraft(value, elementPath, liveTargetIds),
  );
  if (!drafts.ok) return drafts;
  const draftDuplicate = firstDuplicate(drafts.value, 'draftId', '/drafts');
  if (draftDuplicate) return { ok: false, error: draftDuplicate };

  const reviewNote = data['reviewNote'];
  if (typeof reviewNote !== 'string') {
    return fail('invalid-record', '/reviewNote', 'reviewNote must be a string.');
  }

  const selectedTargetId = data['selectedTargetId'];
  if (selectedTargetId !== null && !isNonEmptyString(selectedTargetId)) {
    return fail(
      'invalid-record',
      '/selectedTargetId',
      'selectedTargetId must be a string or null.',
    );
  }

  const selectedFileOccurrence = data['selectedFileOccurrence'];
  if (selectedFileOccurrence !== null && !isNonnegativeInteger(selectedFileOccurrence)) {
    return fail(
      'invalid-record',
      '/selectedFileOccurrence',
      'selectedFileOccurrence must be a nonnegative integer or null.',
    );
  }

  const reviewedMarkers = validateArray(
    data['reviewedMarkers'],
    '/reviewedMarkers',
    'reviewedMarkers',
    validateReviewedMarker,
  );
  if (!reviewedMarkers.ok) return reviewedMarkers;

  return {
    ok: true,
    value: {
      version: DIFF_REVIEW_STATE_VERSION,
      targets: targets.value,
      comments: comments.value,
      drafts: drafts.value,
      reviewNote,
      selectedTargetId,
      selectedFileOccurrence,
      reviewedMarkers: reviewedMarkers.value,
    },
  };
}
