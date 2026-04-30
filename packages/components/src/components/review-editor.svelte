<script lang="ts" module>
  import type { ReviewEditorProps as ReviewEditorImplementationProps } from './review-editor/review-editor-types.ts';

  export type ReviewEditorProps = ReviewEditorImplementationProps;
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';
  import ReviewEditorImplementation from './review-editor/review-editor.svelte';

  let {
    class: customClassName,
    value = $bindable(''),
    threads = $bindable([]),
    ...rest
  }: ReviewEditorProps = $props();

  const mergedClassName = $derived(classNames(customClassName));
</script>

<ReviewEditorImplementation class={mergedClassName} bind:value bind:threads {...rest} />
