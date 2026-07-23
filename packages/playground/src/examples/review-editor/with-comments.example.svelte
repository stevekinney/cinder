<script lang="ts" module>
  export const title = 'Review editor with comments';
  export const description = 'Anchored text comments and document-level feedback.';
</script>

<script lang="ts">
  import { ReviewEditor } from '@lostgradient/editor/review-editor';
  import type { Thread } from '@lostgradient/editor/review-editor';
  const original = `# Architecture Notes

This document describes the review workflow for collaborative editing.

## Feedback

Comments should stay anchored when nearby text changes. Export actions should produce summaries, unified diffs, and comment markdown.`;

  let value = $state(`---
owner: platform
status: draft
---

# Architecture Notes

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
        from: 3,
        to: 21,
        quote: 'Architecture Notes',
        prefix: '# ',
        suffix: '\n\nThis document',
        status: 'anchored',
        originalQuote: 'Architecture Notes',
        lastKnownOffset: 3,
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
    {
      id: 'thread-document',
      createdAt: '2026-04-30T12:10:00.000Z',
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
      comments: [
        {
          id: 'comment-document',
          threadId: 'thread-document',
          authorId: 'steve',
          body: 'The overall shape is ready for review.',
          createdAt: '2026-04-30T12:10:00.000Z',
        },
      ],
    },
  ]);
</script>

<div style="min-height: 38rem;">
  <ReviewEditor
    id="playground-review-editor-comments"
    {original}
    bind:value
    bind:threads
    currentUserId="steve"
  />
</div>
