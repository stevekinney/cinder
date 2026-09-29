/**
 * Pure helpers for ReviewEditor's opt-in diff-review integration (COR-512 / DR-7).
 *
 * `ReviewEditor` is a single-target diff-review host: its bound `original`/`value` pair is
 * always exactly one `markdown` target, keyed by the component's own `id`. These helpers build
 * that target, project the component's existing ProseMirror-anchored `threads` into DR-5's
 * existing-document export variant, and compare two `DiffReviewState` values for the
 * host-notification loop guard `review-editor-impl.svelte` needs (`restoreDiffReviewState`
 * always allocates fresh comment/draft arrays, even when nothing changed, so reference equality
 * can never be the guard).
 *
 * No rune/DOM dependency lives here — matching `diff-review-state`'s own SSR-safe convention —
 * so this module is fully covered by plain `bun:test`.
 *
 * @module
 */

import type { Comment, Thread } from '../../comments/index.ts';
import type {
  DiffReviewMarkdownTargetInput,
  DiffReviewState,
} from '../../diff-review-state/index.ts';
import type {
  DiffReviewExportDocumentAnchor,
  DiffReviewExportDocumentThread,
  DiffReviewExportDocumentThreadMessage,
} from '../../export/index.ts';

/** The label every ReviewEditor diff target renders in locations/exports. */
export const REVIEW_EDITOR_DIFF_REVIEW_LABEL = 'Document diff';

/**
 * Builds the one `markdown` target ReviewEditor's bound `original`/`value` pair represents.
 * `targetId` is the host's own `id` prop — a single-target host has nothing else stable to key
 * on, and changing `id` across mounts is documented (README) to retire the prior target as
 * removed, exactly like any other target-identity change.
 */
export function buildReviewEditorDiffReviewTarget(
  id: string,
  original: string,
  value: string,
  normalizeInputs = true,
): DiffReviewMarkdownTargetInput {
  return {
    targetId: id,
    kind: 'markdown',
    label: REVIEW_EDITOR_DIFF_REVIEW_LABEL,
    original,
    current: value,
    normalizeInputs,
  };
}

/**
 * Value equality for two `DiffReviewState`s. `restoreDiffReviewState` (by way of
 * `applySetTargets`) always maps `comments`/`drafts` into fresh arrays, even when no target
 * content changed, so a reference check would always report "changed" and the host-notification
 * effect would loop on every render. Every field here is already JSON-safe (the type IS the
 * serialized shape — see `DiffReviewSerializedState`), so a JSON comparison is exact and cheap
 * enough for a per-effect guard.
 */
export function diffReviewStatesEqual(a: DiffReviewState, b: DiffReviewState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function projectDocumentAnchor(thread: Thread): DiffReviewExportDocumentAnchor {
  if (thread.anchor.type === 'document') return { kind: 'document' };
  return {
    kind: 'document-text',
    quote: thread.anchor.quote,
    prefix: thread.anchor.prefix || null,
    suffix: thread.anchor.suffix || null,
  };
}

function projectDocumentMessage(comment: Comment): DiffReviewExportDocumentThreadMessage {
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt,
    ...(comment.deletedAt !== undefined ? { deletedAt: comment.deletedAt } : {}),
  };
}

/**
 * Projects ReviewEditor's existing ProseMirror-anchored `threads` into DR-5's existing-document
 * export variant (`diff-review-export-types.ts`), for `exportAggregateReviewMarkdown`/
 * `exportAggregateReviewJson`'s `documentThreads` option. `targetId` namespaces every thread's
 * export ID (`['document', targetId, threadId]`) — passing the same `id` ReviewEditor's diff
 * target uses is safe, since the two record kinds never collide on export ID.
 *
 * Soft-deleted messages keep their `deletedAt` rather than being filtered out here: the exporter
 * (`diff-review-export-model.ts`) already applies the exact same `!deletedAt` predicate this
 * package's own comment list uses, and dropping the thread entirely when every message is
 * deleted is also the exporter's job, not this projection's.
 */
export function projectReviewEditorDocumentThreads(
  targetId: string,
  threads: Thread[],
): DiffReviewExportDocumentThread[] {
  return threads.map((thread) => ({
    targetId,
    threadId: thread.id,
    createdAt: thread.createdAt,
    anchor: projectDocumentAnchor(thread),
    messages: thread.comments.map(projectDocumentMessage),
  }));
}
