import { describe, expect, test } from 'bun:test';
import type { Thread } from '../../comments/types.ts';
import { nextCommentThread, orderedTextThreads } from './comment-navigation.ts';

/**
 * cinder#1304 — the ordering/wrap-around math behind ReviewEditor's keyboard
 * "next/previous comment" navigation. Split into a pure module (rather than
 * tested only through the full component) because mounting
 * review-editor-impl.svelte pulls in ReviewEditorControls' formatting
 * toolbar, which does not render in this package's happy-dom harness for
 * reasons unrelated to this fix (a pre-existing @lostgradient/cinder
 * Dropdown/DropdownTrigger incompatibility, reproduced with zero threads and
 * no interaction at all — not something this change touches or introduces).
 * The DOM-touching half this logic feeds (moving the ProseMirror selection,
 * opening the popover) is wired in review-editor-impl.svelte and verified in
 * a real browser separately, per this package's harness-skeptic guidance.
 */

function textThread(
  id: string,
  from: number,
  to: number,
  status: 'anchored' | 'orphaned' = 'anchored',
): Thread {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    anchor: {
      from,
      to,
      quote: 'quote',
      prefix: '',
      suffix: '',
      status,
      originalQuote: 'quote',
    },
    comments: [],
  };
}

function documentThread(id: string): Thread {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    anchor: {
      type: 'document',
      from: 0,
      to: 0,
      quote: '',
      prefix: '',
      suffix: '',
      status: 'anchored',
      originalQuote: '',
    },
    comments: [],
  } as unknown as Thread;
}

describe('orderedTextThreads', () => {
  test('sorts text-anchored threads by document position', () => {
    const threads = [textThread('c', 30, 40), textThread('a', 1, 10), textThread('b', 15, 20)];
    expect(orderedTextThreads(threads).map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  test('excludes document-level threads — they have no position to navigate to', () => {
    const threads = [documentThread('doc'), textThread('a', 1, 10)];
    expect(orderedTextThreads(threads).map((t) => t.id)).toEqual(['a']);
  });

  test('excludes orphaned threads — their quote is not in the document', () => {
    const threads = [textThread('a', 1, 10), textThread('b', 15, 20, 'orphaned')];
    expect(orderedTextThreads(threads).map((t) => t.id)).toEqual(['a']);
  });
});

describe('nextCommentThread', () => {
  test('with no active thread, "next" lands on the first thread in document order', () => {
    const threads = [textThread('b', 15, 20), textThread('a', 1, 10)];
    expect(nextCommentThread(threads, null, 1)?.id).toBe('a');
  });

  test('with no active thread, "previous" lands on the last thread in document order', () => {
    const threads = [textThread('b', 15, 20), textThread('a', 1, 10)];
    expect(nextCommentThread(threads, null, -1)?.id).toBe('b');
  });

  test('advances forward through threads in order', () => {
    const threads = [textThread('a', 1, 10), textThread('b', 15, 20), textThread('c', 30, 40)];
    expect(nextCommentThread(threads, 'a', 1)?.id).toBe('b');
    expect(nextCommentThread(threads, 'b', 1)?.id).toBe('c');
  });

  test('wraps forward past the last thread back to the first', () => {
    const threads = [textThread('a', 1, 10), textThread('b', 15, 20)];
    expect(nextCommentThread(threads, 'b', 1)?.id).toBe('a');
  });

  test('wraps backward past the first thread back to the last', () => {
    const threads = [textThread('a', 1, 10), textThread('b', 15, 20)];
    expect(nextCommentThread(threads, 'a', -1)?.id).toBe('b');
  });

  test('an active thread that no longer exists (e.g. deleted) is treated the same as no active thread', () => {
    const threads = [textThread('a', 1, 10), textThread('b', 15, 20)];
    expect(nextCommentThread(threads, 'deleted-thread', 1)?.id).toBe('a');
  });

  test('returns null when there is nothing to navigate to', () => {
    expect(nextCommentThread([], null, 1)).toBeNull();
    expect(nextCommentThread([documentThread('doc')], null, 1)).toBeNull();
  });

  test('a single thread returns itself in either direction (wraps to itself)', () => {
    const threads = [textThread('a', 1, 10)];
    expect(nextCommentThread(threads, 'a', 1)?.id).toBe('a');
    expect(nextCommentThread(threads, 'a', -1)?.id).toBe('a');
  });
});
