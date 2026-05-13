<script lang="ts">
  import { getSurfaceContext } from '../../_internal/surface-context.ts';

  const context = getSurfaceContext();
</script>

<!--
  Reads the SurfaceContext published by a parent <Surface> and writes the
  current tone onto a data-* attribute so tests can query it deterministically.
  Renders 'none' when no enclosing <Surface> exists (getSurfaceContext returns undefined).
-->
<div data-testid="probe-tone" data-tone={context?.tone ?? 'none'}></div>
