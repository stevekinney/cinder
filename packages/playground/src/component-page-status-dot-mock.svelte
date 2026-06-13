<script lang="ts">
  let { status = 'neutral', label = '' }: { status?: string; label?: string } = $props();
</script>

<span role="img" data-status={status} aria-label={label || undefined}></span>
