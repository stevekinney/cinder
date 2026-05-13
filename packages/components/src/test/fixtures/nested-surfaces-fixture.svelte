<script lang="ts">
  import Surface from '../../components/surface.svelte';
  import SurfaceContextProbe from './surface-context-probe.svelte';
</script>

<!--
  Renders outer Surface (raised) containing:
  - an outer SurfaceContextProbe (should read 'raised')
  - an inner Surface (transparent) containing:
    - an inner SurfaceContextProbe (should read 'transparent')
  Tests that nested Surface overrides the parent context for its own subtree.
-->
<Surface tone="raised">
  <SurfaceContextProbe testid="outer-probe" />
  <Surface tone="transparent">
    <SurfaceContextProbe testid="inner-probe" />
  </Surface>
</Surface>
