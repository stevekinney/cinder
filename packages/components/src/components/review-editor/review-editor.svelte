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
  import type { ReviewEditorProps } from './review-editor.types.ts';

  let {
    class: customClassName,
    original = $bindable(''),
    value = $bindable(''),
    threads = $bindable([]),
    ...rest
  }: ReviewEditorProps = $props();

  const mergedClassName = $derived(classNames(customClassName));
</script>

<ReviewEditorImplementation
  class={mergedClassName}
  bind:original
  bind:value
  bind:threads
  {...rest}
/>
