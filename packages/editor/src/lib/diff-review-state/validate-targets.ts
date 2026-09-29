/**
 * Atomic validation for a supplied target list (DR-2 normative handoff, "Identity, schema, and
 * validation").
 *
 * Invalid target discriminants, duplicate IDs, or non-string content reject the whole update:
 * the first error is reported in schema-field order, then array order, with a JSON Pointer path.
 * Nothing here allocates an ID, reads a clock, or computes identity — validation is a pure
 * shape check over the input as supplied.
 *
 * @module
 */

import type { DiffReviewError, DiffReviewResult, DiffReviewTargetInput } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function invalidTarget(path: string, message: string): DiffReviewError {
  return { code: 'invalid-target', path, message };
}

/**
 * Validates one target at `/targets/<index>`, in schema-field order: `kind`, `targetId`,
 * `label`, `repositoryLabel`, `baseRevisionLabel`, `headRevisionLabel`, then the
 * discriminant-specific fields (`patch`, or `original`/`current`/`normalizeInputs`).
 */
function validateOneTarget(input: unknown, index: number): DiffReviewError | undefined {
  const base = `/targets/${index}`;
  if (!isRecord(input)) return invalidTarget(base, 'A target must be an object.');

  const kind = input['kind'];
  if (kind !== 'source' && kind !== 'markdown') {
    return invalidTarget(`${base}/kind`, "A target's kind must be 'source' or 'markdown'.");
  }
  if (!isNonEmptyString(input['targetId'])) {
    return invalidTarget(`${base}/targetId`, 'targetId must be a nonempty string.');
  }
  if (!isNonEmptyString(input['label'])) {
    return invalidTarget(`${base}/label`, 'label must be a nonempty string.');
  }
  if (!isOptionalString(input['repositoryLabel'])) {
    return invalidTarget(`${base}/repositoryLabel`, 'repositoryLabel must be a string.');
  }
  if (!isOptionalString(input['baseRevisionLabel'])) {
    return invalidTarget(`${base}/baseRevisionLabel`, 'baseRevisionLabel must be a string.');
  }
  if (!isOptionalString(input['headRevisionLabel'])) {
    return invalidTarget(`${base}/headRevisionLabel`, 'headRevisionLabel must be a string.');
  }

  if (kind === 'source') {
    if (typeof input['patch'] !== 'string') {
      return invalidTarget(`${base}/patch`, 'A source target requires a string patch.');
    }
    return undefined;
  }

  if (typeof input['original'] !== 'string') {
    return invalidTarget(`${base}/original`, 'A markdown target requires a string original.');
  }
  if (typeof input['current'] !== 'string') {
    return invalidTarget(`${base}/current`, 'A markdown target requires a string current.');
  }
  if (typeof input['normalizeInputs'] !== 'boolean') {
    return invalidTarget(
      `${base}/normalizeInputs`,
      'A markdown target requires a boolean normalizeInputs.',
    );
  }
  return undefined;
}

/**
 * Validates a supplied target list atomically. Returns the first schema error (in array order),
 * then the first duplicate `targetId` (pointing at the second occurrence), or the validated list
 * unchanged. Never reorders or mutates the input.
 */
export function validateDiffReviewTargetList(
  targets: DiffReviewTargetInput[],
): DiffReviewResult<DiffReviewTargetInput[]> {
  if (!Array.isArray(targets)) {
    return {
      ok: false,
      error: { code: 'invalid-target', path: '/targets', message: 'targets must be an array.' },
    };
  }

  for (const [index, target] of targets.entries()) {
    const error = validateOneTarget(target, index);
    if (error) return { ok: false, error };
  }

  const seen = new Map<string, number>();
  for (const [index, target] of targets.entries()) {
    const previousIndex = seen.get(target.targetId);
    if (previousIndex !== undefined) {
      return {
        ok: false,
        error: {
          code: 'duplicate-id',
          path: `/targets/${index}/targetId`,
          message: `Duplicate targetId '${target.targetId}' (first seen at index ${previousIndex}).`,
        },
      };
    }
    seen.set(target.targetId, index);
  }

  return { ok: true, value: targets };
}
