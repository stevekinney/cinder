<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status domain-suite
   * @purpose Markdown editor extended with inline review threads, anchored comments, and collaborative annotation state.
   * @tag markdown
   * @tag review
   * @tag domain-suite
   * @useWhen Building a document review experience that needs both a Markdown editor and anchored comment threads in one bundled surface.
   * @useWhen Threading reviewer commentary against specific selections inside a long-form document.
   * @avoidWhen Plain authoring with no review threads — markdown-editor is the lighter primitive.
   * @avoidWhen Reviewing diffs between two documents rather than annotating one — use diff-viewer instead.
   * @related markdown-editor
   */
  export type { ReviewEditorProps } from './review-editor.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import ReviewEditorImplementation from './review-editor-impl.svelte';
  import type { ReviewEditorProps, ReviewFormData } from './review-editor.types.ts';
  import type { ReviewState } from '../../comments/index.ts';
  import type { EditorSelection } from '../../editor/types.ts';
  import type {
    MarkdownSummaryOptions,
    MarkdownSummaryResult,
    UnifiedDiffOptions,
    UnifiedDiffResult,
  } from '../../export/types.ts';

  let {
    class: customClassName,
    original = $bindable(''),
    value = $bindable(''),
    threads = $bindable([]),
    ...rest
  }: ReviewEditorProps = $props();

  const mergedClassName = $derived(classNames(customClassName));

  // The implementation owns the imperative surface (getState/setState, the
  // thread and comment mutators, the export helpers). This wrapper exists only
  // to normalize `class`, so it must forward that surface rather than swallow
  // it — without this, `bind:this` on <ReviewEditor> yields a component with no
  // methods and the entire persistence round-trip is unreachable from the
  // published entry point.
  let implementation = $state<ReviewEditorImplementation>();

  function requireImplementation(): ReviewEditorImplementation {
    if (!implementation) {
      throw new Error('ReviewEditor is not mounted yet — call this after the component mounts.');
    }
    return implementation;
  }

  export function focus(): void {
    requireImplementation().focus();
  }
  export function getMarkdown(): string {
    return requireImplementation().getMarkdown();
  }
  export function setMarkdown(content: string): void {
    requireImplementation().setMarkdown(content);
  }
  export function getAst() {
    return requireImplementation().getAst();
  }
  export function getSelection(): EditorSelection | null {
    return requireImplementation().getSelection();
  }
  export function scrollToThread(threadId: string): void {
    requireImplementation().scrollToThread(threadId);
  }
  export function getState(): ReviewState {
    return requireImplementation().getState();
  }
  export function setState(state: ReviewState): void {
    requireImplementation().setState(state);
  }
  export function getView() {
    return requireImplementation().getView();
  }
  export function getEditor() {
    return requireImplementation().getEditor();
  }
  export function exportMarkdownSummary(
    options: MarkdownSummaryOptions | undefined = undefined,
  ): MarkdownSummaryResult {
    return requireImplementation().exportMarkdownSummary(options);
  }
  export function exportUnifiedDiff(
    options: UnifiedDiffOptions | undefined = undefined,
  ): UnifiedDiffResult {
    return requireImplementation().exportUnifiedDiff(options);
  }
  export function getFormData(): ReviewFormData {
    return requireImplementation().getFormData();
  }
  export function reset(): void {
    requireImplementation().reset();
  }
  export function createThread(body: string, authorId: string): string | null {
    return requireImplementation().createThread(body, authorId);
  }
  export function createDocumentThread(body: string, authorId: string): string | null {
    return requireImplementation().createDocumentThread(body, authorId);
  }
  export function createBlockThread(body: string, authorId: string): string | null {
    return requireImplementation().createBlockThread(body, authorId);
  }
  export function deleteThread(threadId: string): void {
    requireImplementation().deleteThread(threadId);
  }
  export function clearAllThreads(): void {
    requireImplementation().clearAllThreads();
  }
  export function createComment(threadId: string, body: string, authorId: string): string | null {
    return requireImplementation().createComment(threadId, body, authorId);
  }
  export function updateComment(threadId: string, commentId: string, body: string): void {
    requireImplementation().updateComment(threadId, commentId, body);
  }
  export function deleteComment(threadId: string, commentId: string, soft: boolean = true): void {
    requireImplementation().deleteComment(threadId, commentId, soft);
  }
</script>

<ReviewEditorImplementation
  bind:this={implementation}
  class={mergedClassName}
  bind:original
  bind:value
  bind:threads
  {...rest}
/>
