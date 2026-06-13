<script lang="ts">
  let {
    checked = $bindable(false),
    label = '',
    id = '',
  }: { checked?: boolean; label?: string; id?: string; hideLabel?: boolean } = $props();
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label || undefined}
  data-toggle-id={id}
  onclick={() => (checked = !checked)}
></button>
