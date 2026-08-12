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

  // Anchor positions are ProseMirror positions against the full document, never
  // indices into the Markdown string. "Architecture Notes" occupies body
  // positions 1..19 in the parsed document, and its doc.textBetween() offset —
  // which is what lastKnownOffset stores — is 0. The front matter above is 38
  // characters, and the component subtracts that before handing anchors to the
  // editor, so the values below are the body numbers plus 38.
  // prefix/suffix are text too: heading markup like "# " appears in no text
  // space at all, and textBetween joins blocks with a single newline.
  let threads = $state<Thread[]>([
    {
      id: 'thread-architecture-title',
      createdAt: '2026-04-30T12:00:00.000Z',
      anchor: {
        from: 39,
        to: 57,
        quote: 'Architecture Notes',
        prefix: '',
        suffix: '\nThis document describes the review workflow for ',
        status: 'anchored',
        originalQuote: 'Architecture Notes',
        lastKnownOffset: 38,
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
