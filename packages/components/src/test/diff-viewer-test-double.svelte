<script lang="ts">
  let {
    original = '',
    current = '',
    normalizeInputs = true,
    readonly = false,
  }: {
    original?: string;
    current?: string;
    normalizeInputs?: boolean;
    readonly?: boolean;
  } = $props();
</script>

<div
  class="diff-viewer cinder-diff-viewer-test-double"
  data-original={original}
  data-current={current}
  data-normalize-inputs={String(normalizeInputs)}
  data-readonly={String(readonly)}
>
  <pre>{current}</pre>
</div>
