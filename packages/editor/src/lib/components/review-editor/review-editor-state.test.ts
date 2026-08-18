/**
 * Tests for `createReviewEditorState`'s diffStats (cinder#1307).
 *
 * `createReviewEditorState` (exported publicly from `@lostgradient/editor/review-editor`)
 * is a second, independent public API path to the same "how many lines
 * changed" question the ReviewEditor toolbar answers. It had its own copy of
 * the same bare-`normalize()` bug #1307 fixed in the toolbar's `diffStats`:
 * a consumer building their own review UI on top of this state manager saw
 * the front-matter-edit-counted-as-two-lines bug even after the toolbar was
 * fixed, because this file never called the fix.
 *
 * `$derived.by` runs fine outside a component or `$effect.root` for a single
 * synchronous read (no reactive tracking is needed here, just evaluation),
 * matching how `review-editor-anchors-orphan.test.ts` exercises
 * `createAnchorManager` the same way.
 */
import { describe, expect, test } from 'bun:test';
import { createReviewEditorState } from './review-editor-state.svelte.ts';

describe('createReviewEditorState diffStats', () => {
  test('counts a one-line front-matter value edit as one modified line, not two', () => {
    const original = '---\ntitle: Release Plan\nowner: jane\n---\n\nShip it.\n';
    const current = '---\ntitle: Release Plan\nowner: bob\n---\n\nShip it.\n';

    const state = createReviewEditorState({
      getOriginal: () => original,
      getValue: () => current,
      getThreads: () => [],
    });

    expect(state.diffStats).toEqual({ added: 0, removed: 0, modified: 1 });
  });

  test('agrees with the ReviewEditor toolbar for the same content', () => {
    // Both public paths must describe the same edit the same way. Regressing
    // either one back to a bare normalize() call would make them disagree
    // again, silently, for any consumer using both.
    const original = '---\ntitle: Plan\nowner: jane\n---\n\n# Plan\n\nBody.\n';
    const current = '---\ntitle: Plan\nowner: bob\n---\n\n# Plan\n\nBody.\n';

    const state = createReviewEditorState({
      getOriginal: () => original,
      getValue: () => current,
      getThreads: () => [],
    });

    expect(state.diffStats).toEqual({ added: 0, removed: 0, modified: 1 });
  });

  test('still normalizes the body underneath front matter', () => {
    const original = '---\ntitle: Plan\n---\n\n- one\n- two\n';
    const starred = '---\ntitle: Plan\n---\n\n* one\n* two\n';

    const state = createReviewEditorState({
      getOriginal: () => original,
      getValue: () => starred,
      getThreads: () => [],
    });

    expect(state.diffStats).toEqual({ added: 0, removed: 0, modified: 0 });
    expect(state.hasContentChanges).toBe(false);
  });

  test('returns zeroed stats when there is no original', () => {
    const state = createReviewEditorState({
      getOriginal: () => '',
      getValue: () => 'New content',
      getThreads: () => [],
    });

    expect(state.diffStats).toEqual({ added: 0, removed: 0, modified: 0 });
  });

  test('exposes view controls, visible comment count, and summary content', () => {
    const state = createReviewEditorState({
      getOriginal: () => 'Original content.\n',
      getValue: () => 'Updated content.\n',
      getThreads: () => [
        {
          id: 'thread-1',
          createdAt: '2026-08-18T00:00:00.000Z',
          anchor: {
            quote: 'Updated',
            prefix: '',
            suffix: ' content.',
            status: 'anchored',
            from: 0,
            to: 7,
            originalPosition: { offset: 0, line: 1, column: 1 },
          },
          comments: [
            {
              id: 'comment-1',
              threadId: 'thread-1',
              authorId: 'reviewer',
              body: 'Visible comment',
              createdAt: '2026-08-18T00:00:00.000Z',
            },
            {
              id: 'comment-2',
              threadId: 'thread-1',
              authorId: 'reviewer',
              body: 'Deleted comment',
              createdAt: '2026-08-18T00:00:00.000Z',
              deletedAt: '2026-08-18T00:01:00.000Z',
            },
          ],
        },
      ],
    });

    expect(state.activeView).toBe('editor');
    state.setActiveView('summary');
    expect(state.activeView).toBe('summary');

    expect(state.diffViewMode).toBe('unified');
    state.setDiffViewMode('final');
    expect(state.diffViewMode).toBe('final');

    expect(state.commentCount).toBe(1);
    expect(state.summaryContent).toContain('Visible comment');
    expect(state.summaryContent).not.toContain('# Review Summary');
  });
});
