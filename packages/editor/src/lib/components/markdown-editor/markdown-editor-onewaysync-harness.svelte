<script lang="ts">
  /**
   * Test-only fixture for
   * `markdown-editor.setmarkdown-onewaysync.test.ts` (cinder#1328). Mirrors
   * ReviewEditor's actual shape around MarkdownEditor: a `$state` value
   * feeding a `$derived` that is passed to MarkdownEditor's `value` prop
   * one-way (no `bind:`) — matching `<MarkdownEditor value={editorValue}
   * .../>` in review-editor-impl.svelte. This is more faithful than driving
   * `@testing-library/svelte`'s `render`/`rerender` directly against
   * MarkdownEditor: `rerender` reassigns a `$state.raw`-boxed props object
   * (see `props.svelte.js` in `@testing-library/svelte-core`), which is a
   * real "no binding" prop update but not the same reactive graph shape
   * (state -> derived -> prop) ReviewEditor itself builds, and does not
   * reproduce cinder#1328.
   *
   * `dualWriteSetMarkdown` mirrors ReviewEditor.setMarkdown's actual write
   * pattern (review-editor-impl.svelte, ~932-934): it writes ITS OWN
   * `value` AND calls the child's `setMarkdown()` in the same synchronous
   * pass. That specific pairing is what cinder#1328 depends on —
   * `setMarkdownOnEditor` (a plain call to the child's `setMarkdown()` with
   * no matching parent-level write) does not reproduce it, which is why the
   * test file exercises both.
   */
  import MarkdownEditor from './markdown-editor.svelte';

  let { initialValue = '' }: { initialValue?: string } = $props();

  // svelte-ignore state_referenced_locally -- seeding local state from an
  // initial prop, then treating it as independently controlled afterward,
  // is intentional here (see link-popover.svelte for the same pattern).
  let outerValue = $state(initialValue);
  const passedValue = $derived(outerValue);
  let editorRef: MarkdownEditor | undefined = $state();

  export function setOuterValue(nextValue: string): void {
    outerValue = nextValue;
  }

  export function setMarkdownOnEditor(content: string): void {
    editorRef?.setMarkdown(content);
  }

  /** Mirrors ReviewEditor.setMarkdown's dual write (review-editor-impl.svelte, ~932-934). */
  export function dualWriteSetMarkdown(content: string): void {
    outerValue = content;
    editorRef?.setMarkdown(content);
  }

  export function getLiveMarkdown(): string {
    return editorRef?.getMarkdown() ?? '';
  }

  export function applyUserEdit(suffix: string): void {
    const view = editorRef?.getView();
    if (!view) return;
    view.dispatch(view.state.tr.insertText(suffix, view.state.doc.content.size - 1));
  }

  export function applyUserEditWithoutHistory(suffix: string): void {
    const view = editorRef?.getView();
    if (!view) return;
    view.dispatch(
      view.state.tr
        .insertText(suffix, view.state.doc.content.size - 1)
        .setMeta('addToHistory', false),
    );
  }
</script>

<MarkdownEditor
  bind:this={editorRef}
  value={passedValue}
  id="onewaysync-harness"
  label="One-way sync harness"
  showToolbar={false}
/>
