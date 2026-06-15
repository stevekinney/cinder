<script lang="ts">
  // Mirrors the real StatusDot's prop surface for the doc-page tests: `status`
  // and `label` are named, and the rest (e.g. `aria-hidden`) is spread onto the
  // element just as the real component spreads `{...rest}`.
  let {
    status = 'neutral',
    label = '',
    ...rest
  }: { status?: string; label?: string; [key: string]: unknown } = $props();
</script>

<span {...rest} role="img" data-status={status} aria-label={label || undefined}></span>
