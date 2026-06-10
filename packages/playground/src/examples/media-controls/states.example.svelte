<script lang="ts" module>
  export const title = 'Media control states';
  export const description = 'All states: paused, playing, loading, disabled, and unavailable.';
</script>

<script lang="ts">
  import { MediaControls } from '@lostgradient/cinder/media-controls';
</script>

<div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;">
  <MediaControls layout="expanded" />
  <MediaControls layout="expanded" playing />
  <MediaControls layout="expanded" replay />
  <MediaControls layout="expanded" loading />
  <MediaControls layout="expanded" disabled />
  <MediaControls layout="expanded" unavailable />
</div>
