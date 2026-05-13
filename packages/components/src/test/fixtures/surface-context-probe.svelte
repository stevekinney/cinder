<script lang="ts">
  import { getSurfaceContext } from '../../_internal/surface-context.ts';

  let { testid = 'probe-tone' }: { testid?: string } = $props();

  const context = getSurfaceContext();
</script>

<!--
  Reads the SurfaceContext published by a parent <Surface> and writes the
  current tone onto a data-* attribute so tests can query it deterministically.
  Renders 'none' when no enclosing <Surface> exists (getSurfaceContext returns undefined).
-->
<div data-testid={testid} data-tone={context?.tone ?? 'none'}></div>
