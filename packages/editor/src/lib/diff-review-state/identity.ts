/**
 * Content identity for diff-review targets (DR-2 normative handoff, "Identity, schema, and
 * validation").
 *
 * Identity is the lowercase SHA-256 hex of the UTF-8 bytes of `JSON.stringify` applied to a fixed
 * tuple: `['diff-review-v1', 'source', patch]` for a source target, or
 * `['diff-review-v1', 'markdown', original, current, normalizeInputs]` for a Markdown target.
 * Label, path, revision labels, ordering, display mode, and line limits are never hash inputs.
 *
 * `sha256` comes from `@noble/hashes/sha2.js`, a portable synchronous implementation that works
 * identically during SSR and in the browser, unlike Node's `node:crypto` (unavailable in a
 * browser bundle) or `crypto.subtle` (asynchronous only). `JSON.stringify` escapes lone
 * surrogates to their `\uXXXX` form before this module ever reaches `TextEncoder`, so identity is
 * stable even for input strings containing unpaired surrogate code units, which `TextEncoder`
 * alone would otherwise silently replace with U+FFFD.
 *
 * @module
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

import type { DiffReviewTargetInput } from './types.js';

const encoder = new TextEncoder();

type DiffReviewIdentityTuple =
  | readonly ['diff-review-v1', 'source', string]
  | readonly ['diff-review-v1', 'markdown', string, string, boolean];

function identityTupleFor(target: DiffReviewTargetInput): DiffReviewIdentityTuple {
  if (target.kind === 'source') {
    return ['diff-review-v1', 'source', target.patch] as const;
  }
  return [
    'diff-review-v1',
    'markdown',
    target.original,
    target.current,
    target.normalizeInputs,
  ] as const;
}

/**
 * Computes the deterministic content-identity ("snapshot ID") for a target's exact input
 * strings plus its resolved normalization setting. Never fed label, path, revision labels,
 * ordering, or any clock/random value — those never invalidate a comment's identity.
 */
export function computeDiffReviewSnapshotId(target: DiffReviewTargetInput): string {
  const tuple = identityTupleFor(target);
  const bytes = encoder.encode(JSON.stringify(tuple));
  return bytesToHex(sha256(bytes));
}
