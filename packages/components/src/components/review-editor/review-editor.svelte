<script lang="ts" module>
  export type { ReviewEditorProps } from './review-editor.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import ReviewEditorImplementation from './review-editor-impl.svelte';
  import type { ReviewEditorProps } from './review-editor.types.ts';

  let {
    class: customClassName,
    value = $bindable(''),
    threads = $bindable([]),
    ...rest
  }: ReviewEditorProps = $props();

  const mergedClassName = $derived(classNames(customClassName));
</script>

<ReviewEditorImplementation class={mergedClassName} bind:value bind:threads {...rest} />
