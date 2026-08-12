/**
 * Tests for the pure anchor constructors and the persistence converter pair.
 *
 * @module
 */
import { describe, expect, test } from 'bun:test';
import type { Comment, CommentAnchor, PersistedThread, Thread } from './types.js';
import {
  ANCHOR_CONTEXT_LENGTH,
  createDocumentAnchor,
  createTextQuoteAnchor,
  isDocumentAnchor,
  isTextAnchor,
  toPersistedThreads,
  toRuntimeThreads,
} from './types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestComment(overrides?: Partial<Comment>): Comment {
  return {
    id: 'comment-1',
    threadId: 'thread-1',
    authorId: 'maya',
    body: 'This heading is clear.',
    createdAt: '2026-04-30T12:00:00.000Z',
    ...overrides,
  };
}

function createTestThread(anchor: CommentAnchor, overrides?: Partial<Thread>): Thread {
  return {
    id: 'thread-1',
    createdAt: '2026-04-30T12:00:00.000Z',
    anchor,
    comments: [createTestComment()],
    ...overrides,
  };
}

function createTestAnchor(overrides?: Partial<CommentAnchor>): CommentAnchor {
  return {
    quote: 'Architecture Notes',
    prefix: '',
    suffix: '\nThis document',
    from: 39,
    to: 57,
    status: 'anchored',
    originalQuote: 'Architecture Notes',
    lastKnownOffset: 38,
    blockId: 'block-heading',
    originalPosition: { offset: 38, line: 1, column: 1 },
    ...overrides,
  };
}

// ============================================================================
// createTextQuoteAnchor
// ============================================================================

describe('createTextQuoteAnchor', () => {
  const documentText = 'The quick brown fox jumps over the lazy dog.';

  test('captures the quote with surrounding context', () => {
    const anchor = createTextQuoteAnchor('brown fox', documentText, 10, 19);

    expect(anchor.quote).toBe('brown fox');
    expect(anchor.prefix).toBe('The quick ');
    expect(anchor.suffix).toBe(' jumps over the lazy dog.');
  });

  test('clamps context to the document bounds', () => {
    const anchor = createTextQuoteAnchor('The', documentText, 0, 3);

    expect(anchor.prefix).toBe('');
    expect(anchor.suffix).toBe(documentText.slice(3));
  });

  test('caps context at ANCHOR_CONTEXT_LENGTH characters', () => {
    const long = 'x'.repeat(200);
    const anchor = createTextQuoteAnchor('y', `${long}y${long}`, 200, 201);

    expect(anchor.prefix).toHaveLength(ANCHOR_CONTEXT_LENGTH);
    expect(anchor.suffix).toHaveLength(ANCHOR_CONTEXT_LENGTH);
  });
});

// ============================================================================
// createDocumentAnchor / type predicates
// ============================================================================

describe('createDocumentAnchor', () => {
  test('produces an unplaced anchor with no quote', () => {
    const anchor = createDocumentAnchor();

    expect(anchor.type).toBe('document');
    expect(anchor.quote).toBe('');
    expect(anchor.prefix).toBe('');
    expect(anchor.suffix).toBe('');
    expect(anchor.from).toBe(0);
    expect(anchor.to).toBe(0);
    expect(anchor.status).toBe('anchored');
  });

  test('is classified as a document anchor, not a text anchor', () => {
    const anchor = createDocumentAnchor();

    expect(isDocumentAnchor(anchor)).toBe(true);
    expect(isTextAnchor(anchor)).toBe(false);
  });

  test('an anchor with no type but a quote is treated as text for backwards compatibility', () => {
    const anchor = createTestAnchor();

    expect(anchor.type).toBeUndefined();
    expect(isTextAnchor(anchor)).toBe(true);
    expect(isDocumentAnchor(anchor)).toBe(false);
  });

  test('a legacy untyped anchor with no quote is a document anchor, not a text one', () => {
    // `getState()` used to omit `type`, so every review persisted before that
    // was fixed carries document anchors identified only by the absence of a
    // quote. Reading one as a text anchor sends it through reanchorQuote, which
    // cannot find an empty quote and deletes the thread — opening an older
    // saved review would silently lose its document-level comments.
    const legacyAnchor = { ...createDocumentAnchor(), type: undefined };

    expect(legacyAnchor.quote).toBe('');
    expect(isDocumentAnchor(legacyAnchor)).toBe(true);
    expect(isTextAnchor(legacyAnchor)).toBe(false);
  });
});

// ============================================================================
// toPersistedThreads
// ============================================================================

describe('toPersistedThreads', () => {
  test('drops the runtime positions and keeps everything else', () => {
    const [persisted] = toPersistedThreads([createTestThread(createTestAnchor())]);

    expect(persisted).toBeDefined();
    expect(persisted?.anchor).not.toHaveProperty('from');
    expect(persisted?.anchor).not.toHaveProperty('to');
    expect(persisted?.anchor.quote).toBe('Architecture Notes');
    expect(persisted?.anchor.prefix).toBe('');
    expect(persisted?.anchor.suffix).toBe('\nThis document');
    expect(persisted?.anchor.originalQuote).toBe('Architecture Notes');
    expect(persisted?.anchor.lastKnownOffset).toBe(38);
    expect(persisted?.anchor.blockId).toBe('block-heading');
    expect(persisted?.anchor.originalPosition).toEqual({ offset: 38, line: 1, column: 1 });
  });

  test('preserves the anchor type so document comments survive a save', () => {
    // Omitting `type` downgraded document-level anchors to text anchors, which
    // made restoring them delete the thread: an empty quote can never be found.
    const [persisted] = toPersistedThreads([createTestThread(createDocumentAnchor())]);

    expect(persisted?.anchor.type).toBe('document');
    expect(isDocumentAnchor(persisted!.anchor)).toBe(true);
  });
});

// ============================================================================
// toRuntimeThreads
// ============================================================================

describe('toRuntimeThreads', () => {
  test('round-trips thread identity, comments, and every quote field', () => {
    const original = createTestThread(createTestAnchor());
    const [restored] = toRuntimeThreads(toPersistedThreads([original]));

    expect(restored).toBeDefined();
    expect(restored?.id).toBe(original.id);
    expect(restored?.createdAt).toBe(original.createdAt);
    expect(restored?.comments).toEqual(original.comments);
    expect(restored?.anchor.quote).toBe(original.anchor.quote);
    expect(restored?.anchor.prefix).toBe(original.anchor.prefix);
    expect(restored?.anchor.suffix).toBe(original.anchor.suffix);
    expect(restored?.anchor.status).toBe(original.anchor.status);
    expect(restored?.anchor.originalQuote).toBe(original.anchor.originalQuote);
    expect(restored?.anchor.lastKnownOffset).toBe(original.anchor.lastKnownOffset);
    expect(restored?.anchor.blockId).toBe(original.anchor.blockId);
    expect(restored?.anchor.originalPosition).toEqual(original.anchor.originalPosition);
  });

  test('seeds from/to with the unplaced sentinel rather than a guessed position', () => {
    const [restored] = toRuntimeThreads(toPersistedThreads([createTestThread(createTestAnchor())]));

    expect(restored?.anchor.from).toBe(0);
    expect(restored?.anchor.to).toBe(0);
  });

  test('is assignable to Thread[] with no cast', () => {
    const persisted: PersistedThread[] = toPersistedThreads([createTestThread(createTestAnchor())]);
    // The whole point of the export: this line must typecheck without
    // `as unknown as Thread[]`.
    const restored: Thread[] = toRuntimeThreads(persisted);

    expect(restored).toHaveLength(1);
  });

  test('overwrites stray positions that untyped JSON may carry', () => {
    // Persisted state is parsed from storage, so it can carry `from`/`to` that
    // the type does not declare. Trusting them is exactly the coordinate-space
    // mistake the sentinel exists to avoid.
    const stray = {
      ...createTestThread(createTestAnchor()),
      anchor: { ...createTestAnchor(), from: 3, to: 21 },
    } as unknown as PersistedThread;

    const [restored] = toRuntimeThreads([stray]);

    expect(restored?.anchor.from).toBe(0);
    expect(restored?.anchor.to).toBe(0);
  });

  test('passes document anchors through as document anchors', () => {
    const [restored] = toRuntimeThreads(
      toPersistedThreads([createTestThread(createDocumentAnchor())]),
    );

    expect(restored?.anchor.type).toBe('document');
    expect(isDocumentAnchor(restored!.anchor)).toBe(true);
    expect(restored?.anchor.from).toBe(0);
    expect(restored?.anchor.to).toBe(0);
  });

  test('returns an empty array for an empty array', () => {
    expect(toRuntimeThreads([])).toEqual([]);
  });

  test('does not mutate the input threads or their anchors', () => {
    const persisted = toPersistedThreads([createTestThread(createTestAnchor())]);
    const snapshot = structuredClone(persisted);

    const restored = toRuntimeThreads(persisted);

    expect(persisted).toEqual(snapshot);
    expect(restored[0]).not.toBe(persisted[0]);
    expect(restored[0]?.anchor).not.toBe(persisted[0]?.anchor);
  });
});
