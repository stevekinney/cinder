/**
 * Structural validation for the `documentThreads` export option (DR-5, "Export literalness and
 * existing threads"). This is a small, dedicated validator — not a reuse of
 * `diff-review-state/validate-serialized.ts` — because this input is not part of the versioned
 * `DiffReviewState` schema; it is DR-5's own minimal projection shape for the existing-document
 * variant (see `diff-review-export-types.ts`'s module doc). Malformed input here fails export
 * atomically, exactly like a malformed `DiffReviewState`.
 *
 * @module
 */

import type { DiffReviewError, DiffReviewResult } from '../diff-review-state/index.js';
import type {
  DiffReviewExportDocumentAnchor,
  DiffReviewExportDocumentThread,
  DiffReviewExportDocumentThreadMessage,
} from './diff-review-export-types.js';

const THREAD_KEYS = ['targetId', 'threadId', 'createdAt', 'anchor', 'messages'];
const MESSAGE_KEYS = ['id', 'body', 'createdAt', 'deletedAt'];
const DOCUMENT_ANCHOR_KEYS = ['kind'];
const DOCUMENT_TEXT_ANCHOR_KEYS = ['kind', 'quote', 'prefix', 'suffix'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function fail(path: string, message: string): DiffReviewResult<never> {
  const error: DiffReviewError = { code: 'invalid-record', path, message };
  return { ok: false, error };
}

function findUnknownKey(
  input: Record<string, unknown>,
  allowed: readonly string[],
): string | undefined {
  return Object.keys(input).find((key) => !allowed.includes(key));
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function validateMessage(
  value: unknown,
  path: string,
): DiffReviewResult<DiffReviewExportDocumentThreadMessage> {
  if (!isRecord(value)) return fail(path, 'A document thread message must be an object.');
  const unknownKey = findUnknownKey(value, MESSAGE_KEYS);
  if (unknownKey !== undefined) {
    return fail(`${path}/${unknownKey}`, `Unknown key '${unknownKey}'.`);
  }
  if (!isNonemptyString(value['id'])) {
    return fail(`${path}/id`, 'id must be a nonempty string.');
  }
  if (typeof value['body'] !== 'string') {
    return fail(`${path}/body`, 'body must be a string.');
  }
  if (!isNonemptyString(value['createdAt'])) {
    return fail(`${path}/createdAt`, 'createdAt must be a nonempty string.');
  }
  const deletedAt = value['deletedAt'];
  if (deletedAt !== undefined && deletedAt !== null && typeof deletedAt !== 'string') {
    return fail(`${path}/deletedAt`, 'deletedAt must be a string, null, or omitted.');
  }
  return {
    ok: true,
    value: {
      id: value['id'],
      body: value['body'],
      createdAt: value['createdAt'],
      ...(deletedAt !== undefined ? { deletedAt } : {}),
    },
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/**
 * The existing-document anchor variant (contract, "Agent export contract"): `'document'` for a
 * document-level comment, or `'document-text'` with its TextQuoteSelector fields for a
 * text-anchored one. This schema is DR-5's to define in full; DR-7 supplies real values for it
 * without extending the shape.
 */
function validateDocumentAnchor(
  value: unknown,
  path: string,
): DiffReviewResult<DiffReviewExportDocumentAnchor> {
  if (!isRecord(value)) return fail(path, 'anchor must be an object.');
  const kind = value['kind'];
  if (kind === 'document') {
    const unknownKey = findUnknownKey(value, DOCUMENT_ANCHOR_KEYS);
    if (unknownKey !== undefined) {
      return fail(`${path}/${unknownKey}`, `Unknown key '${unknownKey}'.`);
    }
    return { ok: true, value: { kind: 'document' } };
  }
  if (kind === 'document-text') {
    const unknownKey = findUnknownKey(value, DOCUMENT_TEXT_ANCHOR_KEYS);
    if (unknownKey !== undefined) {
      return fail(`${path}/${unknownKey}`, `Unknown key '${unknownKey}'.`);
    }
    if (typeof value['quote'] !== 'string') {
      return fail(`${path}/quote`, 'quote must be a string.');
    }
    if (!isNullableString(value['prefix'])) {
      return fail(`${path}/prefix`, 'prefix must be a string or null.');
    }
    if (!isNullableString(value['suffix'])) {
      return fail(`${path}/suffix`, 'suffix must be a string or null.');
    }
    return {
      ok: true,
      value: {
        kind: 'document-text',
        quote: value['quote'],
        prefix: value['prefix'],
        suffix: value['suffix'],
      },
    };
  }
  return fail(`${path}/kind`, "kind must be 'document' or 'document-text'.");
}

function validateThread(
  value: unknown,
  path: string,
): DiffReviewResult<DiffReviewExportDocumentThread> {
  if (!isRecord(value)) return fail(path, 'A document thread must be an object.');
  const unknownKey = findUnknownKey(value, THREAD_KEYS);
  if (unknownKey !== undefined) {
    return fail(`${path}/${unknownKey}`, `Unknown key '${unknownKey}'.`);
  }
  if (!isNonemptyString(value['targetId'])) {
    return fail(`${path}/targetId`, 'targetId must be a nonempty string.');
  }
  if (!isNonemptyString(value['threadId'])) {
    return fail(`${path}/threadId`, 'threadId must be a nonempty string.');
  }
  if (!isNonemptyString(value['createdAt'])) {
    return fail(`${path}/createdAt`, 'createdAt must be a nonempty string.');
  }
  if (value['anchor'] === undefined) {
    return fail(`${path}/anchor`, 'anchor is required.');
  }
  const anchor = validateDocumentAnchor(value['anchor'], `${path}/anchor`);
  if (!anchor.ok) return anchor;
  if (!Array.isArray(value['messages'])) {
    return fail(`${path}/messages`, 'messages must be an array.');
  }

  const messages: DiffReviewExportDocumentThreadMessage[] = [];
  for (const [index, message] of value['messages'].entries()) {
    const result = validateMessage(message, `${path}/messages/${index}`);
    if (!result.ok) return result;
    messages.push(result.value);
  }

  return {
    ok: true,
    value: {
      targetId: value['targetId'],
      threadId: value['threadId'],
      createdAt: value['createdAt'],
      anchor: anchor.value,
      messages,
    },
  };
}

/**
 * Validates every thread and message in order, failing atomically on the first problem (same
 * "no partial result" rule as `DiffReviewState` export input).
 */
export function validateDiffReviewExportDocumentThreads(
  input: unknown,
): DiffReviewResult<DiffReviewExportDocumentThread[]> {
  if (!Array.isArray(input)) {
    return fail('/documentThreads', 'documentThreads must be an array.');
  }
  const threads: DiffReviewExportDocumentThread[] = [];
  for (const [index, thread] of input.entries()) {
    const result = validateThread(thread, `/documentThreads/${index}`);
    if (!result.ok) return result;
    threads.push(result.value);
  }
  return { ok: true, value: threads };
}
