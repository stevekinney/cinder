<script lang="ts" module>
  export const title = 'Basic toggle';
  export const description = 'Switch with role="switch" and aria-checked reflecting state.';
</script>

<script lang="ts">
  import { Toggle } from '../../../../components/src/index.ts';

  let muted = $state(false);
</script>

<Toggle id="mute" bind:checked={muted} label="Mute audio" />
<p style="margin-top: 0.5rem; color: var(--cinder-text-muted);">
  {muted ? 'Muted' : 'Unmuted'}
</p>
