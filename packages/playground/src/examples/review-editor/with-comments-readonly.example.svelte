<script lang="ts" module>
  export const title = 'Review editor with comments (readonly)';
  export const description =
    'Same anchored thread as "Review editor with comments", but mode="readonly" — for cinder#1304\'s comment-navigation-chord finding: in readonly mode, ProseMirror sets contenteditable="false" on the editor DOM, which removes its native focusability, so a real Tab press lands on the outer .markdown-editor.surface host instead. See comment-anchor-a11y.playwright.ts.';
</script>

<script lang="ts">
  import { ReviewEditor } from '@lostgradient/editor/review-editor';
  import type { Thread } from '@lostgradient/editor/review-editor';
  const original = `# Architecture Notes

This document describes the review workflow for collaborative editing.

## Feedback

Comments should stay anchored when nearby text changes. Export actions should produce summaries, unified diffs, and comment markdown.`;

  // Identical to with-comments.example.svelte, deliberately: same anchor
  // positions, same coordinate-space comment, no front matter — the only
  // difference from that fixture is mode="readonly" below. See that file's
  // own comment for the position math this reuses verbatim.
  let value = $state(`# Architecture Notes

This document describes the review workflow for collaborative editing and handoff.

## Feedback

Comments should stay anchored when nearby text changes. Export actions should produce summaries, unified diffs, and comment markdown.

## Follow-up

The editor should make source, rendered, and diff modes available without leaving the review context.`);

  let threads = $state<Thread[]>([
    {
      id: 'thread-architecture-title',
      createdAt: '2026-04-30T12:00:00.000Z',
      anchor: {
        from: 1,
        to: 19,
        quote: 'Architecture Notes',
        prefix: '',
        suffix: '\nThis document describes the review workflow for ',
        status: 'anchored',
        originalQuote: 'Architecture Notes',
        lastKnownOffset: 0,
      },
      comments: [
        {
          id: 'comment-title',
          threadId: 'thread-architecture-title',
          authorId: 'maya',
          body: 'This title is clear. I would keep it.',
          createdAt: '2026-04-30T12:00:00.000Z',
        },
      ],
    },
  ]);
</script>

<div style="min-height: 38rem;">
  <ReviewEditor
    id="playground-review-editor-comments-readonly"
    mode="readonly"
    {original}
    bind:value
    bind:threads
    currentUserId="steve"
  />
</div>
