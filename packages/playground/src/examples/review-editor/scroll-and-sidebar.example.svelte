<script lang="ts" module>
  export const title = 'Scroll-to-thread and sidebar selection';
  export const description =
    'A tall document with two off-screen anchored threads, an imperative scrollToThread control, and the comment sidebar open — for exercising ReviewEditor.scrollToThread and sidebar/anchor thread selection.';
</script>

<script lang="ts">
  import { ReviewEditor } from '@lostgradient/editor/review-editor';
  import type { Thread } from '@lostgradient/editor/review-editor';
  import Button from '@lostgradient/cinder/button';

  const original = '';

  // No front matter, so ProseMirror body positions below match the document
  // 1:1 (bodyOffset is 0). Positions were derived from this exact text via
  // createDocFromMarkdown + proseMirrorPositionToTextOffset, the same
  // utilities review-editor-regressions.test.ts uses to verify the shipped
  // examples — not hand-computed.
  let value = $state(`# Deep Anchor Playground

Intro paragraph explaining the scenario for automated scroll and sidebar regression tests against ReviewEditor's imperative and sidebar interactions.

## Section One

Paragraph one is filler text that adds vertical height to the document, so that anchors placed further down sit below the viewport fold when the page first loads scrolled to the top.

Paragraph two is filler text as well, again only adding vertical height without changing anything about the anchors that come later in the document.

Paragraph three continues the filler, still just padding out the vertical height of this section before the first real anchor target appears further below.

Paragraph four keeps padding the section with more filler text, so the document grows tall enough for a real off-screen scroll to be observable in a browser.

Paragraph five is the last filler paragraph in this section, bringing the section to a close before the next heading and the first anchor target.

## Section Two

The quick fox anchor sits in this sentence for the first automated thread.

## Section Three

Paragraph six is more filler text between the two anchor targets, so that selecting the second thread requires a further scroll past the first.

Paragraph seven continues that filler, padding out the space between the two anchors so both are meaningfully separated on screen.

The lazy dog anchor sits in this later sentence for the second automated thread.

## Section Four

Closing paragraph after both anchors, just to round out the document.
`);

  let threads = $state<Thread[]>([
    {
      id: 'thread-fox',
      createdAt: '2026-08-01T12:00:00.000Z',
      anchor: {
        from: 999,
        to: 1019,
        quote: 'The quick fox anchor',
        prefix: 'eading and the first anchor target.\nSection Two\n',
        suffix: ' sits in this sentence for the first automated thr',
        status: 'anchored',
        originalQuote: 'The quick fox anchor',
        lastKnownOffset: 989,
      },
      comments: [
        {
          id: 'comment-fox',
          threadId: 'thread-fox',
          authorId: 'maya',
          body: 'First anchored thread, reachable via its document anchor or the sidebar.',
          createdAt: '2026-08-01T12:00:00.000Z',
        },
      ],
    },
    {
      id: 'thread-dog',
      createdAt: '2026-08-01T12:05:00.000Z',
      anchor: {
        from: 1367,
        to: 1386,
        quote: 'The lazy dog anchor',
        prefix: 'rs so both are meaningfully separated on screen.\n',
        suffix: ' sits in this later sentence for the second automa',
        status: 'anchored',
        originalQuote: 'The lazy dog anchor',
        lastKnownOffset: 1353,
      },
      comments: [
        {
          id: 'comment-dog',
          threadId: 'thread-dog',
          authorId: 'steve',
          body: 'Second anchored thread, further down the document.',
          createdAt: '2026-08-01T12:05:00.000Z',
        },
      ],
    },
  ]);

  let editorRef: ReturnType<typeof ReviewEditor> | undefined;
  let scrollResult = $state('');

  function scrollToFox(): void {
    try {
      editorRef?.scrollToThread('thread-fox');
      scrollResult = 'scrolled: thread-fox';
    } catch (error) {
      scrollResult = `error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  function scrollToUnknown(): void {
    try {
      editorRef?.scrollToThread('does-not-exist');
      scrollResult = 'scrolled: does-not-exist';
    } catch (error) {
      scrollResult = `error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
</script>

<div style="display: flex; flex-direction: column; gap: 0.5rem;">
  <div style="display: flex; gap: 0.5rem;">
    <Button data-testid="scroll-to-fox" onclick={scrollToFox}>scrollToThread('thread-fox')</Button>
    <Button data-testid="scroll-to-unknown" onclick={scrollToUnknown}>
      scrollToThread('does-not-exist')
    </Button>
  </div>
  <p data-testid="scroll-result">{scrollResult}</p>

  <ReviewEditor
    bind:this={editorRef}
    id="playground-review-editor-scroll-sidebar"
    {original}
    bind:value
    bind:threads
    currentUserId="steve"
  />
</div>
