/**
 * The EXPORTED `createAnchorManager` (`@lostgradient/editor/review-editor`)
 * against the orphan-preservation contract in `shared/anchor-types.ts`.
 *
 * This manager is experimental and the component does not delegate to it, but it
 * is a shipped, typed, importable API — and it used to be the one path that
 * still DELETED a thread whose quote had gone missing, which is exactly the
 * data loss cinder#1284 was about. These tests pin it to the same contract the
 * inline implementation follows: every thread survives a re-anchoring pass, and
 * one that cannot be placed comes out `orphaned` rather than dropped.
 */

import type { EditorView } from '@milkdown/kit/prose/view';
import { describe, expect, test } from 'bun:test';
import { Schema } from 'prosemirror-model';
// `$effect.root` is a rune, and a plain `.test.ts` is not compiled by the
// Svelte plugin (its filter is `\.svelte\.(js|ts)$`), so the rune is unusable
// here. It compiles to `effect_root`, which `svelte/internal/client` exports
// without type declarations.
// @ts-expect-error -- untyped internal entry point
import { effect_root as untypedEffectRoot } from 'svelte/internal/client';

import type { PersistedThread, ReviewState, Thread } from '../../comments/index.ts';
import { createAnchorManager } from './review-editor-anchors.svelte.ts';

const effectRoot = untypedEffectRoot as (run: () => void) => () => void;

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'text*', toDOM: () => ['p', 0] },
    text: {},
  },
});

const DOCUMENT_TEXT = 'The quick brown fox jumps over the lazy dog.';

function createDoc(text: string) {
  return schema.node('doc', null, [schema.node('paragraph', null, [schema.text(text)])]);
}

function createFakeView(text: string) {
  const dispatched: unknown[] = [];
  const view = {
    state: {
      doc: createDoc(text),
      get tr() {
        return {
          setMeta(key: unknown, value: unknown) {
            return { key, value };
          },
        };
      },
    },
    dispatch(transaction: unknown) {
      dispatched.push(transaction);
    },
  } as unknown as EditorView;

  return { view, dispatched };
}

function persistedThread(
  id: string,
  anchor: Partial<PersistedThread['anchor']> & { quote: string },
): PersistedThread {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    comments: [],
    anchor: {
      prefix: '',
      suffix: '',
      status: 'anchored',
      ...anchor,
    },
  };
}

interface Harness {
  attemptReanchoring: () => void;
  destroy: () => void;
  threads: () => Thread[];
}

/**
 * `createAnchorManager` calls `$effect`, so it has to be constructed inside an
 * effect root or Svelte throws `effect_orphan`.
 */
function createHarness(state: ReviewState, documentText = DOCUMENT_TEXT): Harness {
  const { view } = createFakeView(documentText);
  let threads: Thread[] = [];
  let attemptReanchoring: () => void = () => {};

  const destroy = effectRoot(() => {
    const manager = createAnchorManager({
      getThreads: () => threads,
      setThreads: (next) => {
        threads = next;
      },
      getEditorView: () => view,
      getMarkdown: () => state.content,
      getValue: () => state.content,
      onAnchorClick: () => {},
    });

    manager.setPendingState(state);
    attemptReanchoring = manager.attemptReanchoring;
  });

  return {
    attemptReanchoring,
    destroy,
    threads: () => threads,
  };
}

describe('createAnchorManager (exported, experimental) vs. orphan preservation', () => {
  test('keeps a thread whose quote is absent, marked orphaned', () => {
    const state: ReviewState = {
      schemaVersion: 4,
      content: DOCUMENT_TEXT,
      updatedAt: '2026-01-01T00:00:00.000Z',
      threads: [
        persistedThread('thread-missing', {
          quote: 'a paragraph that was cut to the clipboard',
        }),
      ],
    };

    const harness = createHarness(state);
    try {
      harness.attemptReanchoring();

      // Cut-and-paste is indistinguishable from deletion at this moment, so the
      // thread is kept and can re-anchor if the text comes back.
      expect(harness.threads()).toHaveLength(1);
      expect(harness.threads()[0]?.id).toBe('thread-missing');
      expect(harness.threads()[0]?.anchor.status).toBe('orphaned');
      // Collapsed, so the decoration pass skips it and renders nothing.
      expect(harness.threads()[0]?.anchor.from).toBe(0);
      expect(harness.threads()[0]?.anchor.to).toBe(0);
      // The quote is preserved — it is what a later pass searches for.
      expect(harness.threads()[0]?.anchor.quote).toBe('a paragraph that was cut to the clipboard');
    } finally {
      harness.destroy();
    }
  });

  test('keeps a thread whose quote is still present (control)', () => {
    const state: ReviewState = {
      schemaVersion: 4,
      content: DOCUMENT_TEXT,
      updatedAt: '2026-01-01T00:00:00.000Z',
      threads: [
        persistedThread('thread-found', {
          quote: 'quick brown fox',
          prefix: 'The ',
          suffix: ' jumps',
        }),
      ],
    };

    const harness = createHarness(state);
    try {
      harness.attemptReanchoring();

      expect(harness.threads()).toHaveLength(1);
      expect(harness.threads()[0]?.id).toBe('thread-found');
      expect(harness.threads()[0]?.anchor.status).toBe('anchored');
    } finally {
      harness.destroy();
    }
  });

  test('a mixed restore keeps both threads, one anchored and one orphaned', () => {
    const state: ReviewState = {
      schemaVersion: 4,
      content: DOCUMENT_TEXT,
      updatedAt: '2026-01-01T00:00:00.000Z',
      threads: [
        persistedThread('thread-found', {
          quote: 'lazy dog',
          prefix: 'over the ',
          suffix: '.',
        }),
        persistedThread('thread-missing', {
          quote: 'a paragraph that was cut to the clipboard',
        }),
      ],
    };

    const harness = createHarness(state);
    try {
      harness.attemptReanchoring();

      expect(harness.threads().map((thread) => thread.id)).toEqual([
        'thread-found',
        'thread-missing',
      ]);
      expect(harness.threads().map((thread) => thread.anchor.status)).toEqual([
        'anchored',
        'orphaned',
      ]);
    } finally {
      harness.destroy();
    }
  });

  test('keeps document-level threads ANCHORED, not orphaned', () => {
    const state: ReviewState = {
      schemaVersion: 4,
      content: DOCUMENT_TEXT,
      updatedAt: '2026-01-01T00:00:00.000Z',
      threads: [
        persistedThread('thread-document', {
          quote: '',
          type: 'document',
        }),
      ],
    };

    const harness = createHarness(state);
    try {
      harness.attemptReanchoring();

      // A document-level anchor has no quote to search for, so `reanchorQuote`
      // would always report "not found" and orphan a thread that is not lost at
      // all. The `isDocumentAnchor` guard short-circuits before that.
      expect(harness.threads()).toHaveLength(1);
      expect(harness.threads()[0]?.id).toBe('thread-document');
      expect(harness.threads()[0]?.anchor.status).toBe('anchored');
    } finally {
      harness.destroy();
    }
  });
});
