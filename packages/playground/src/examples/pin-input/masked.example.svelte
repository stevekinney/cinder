<script lang="ts" module>
  export const title = 'Masked PIN';
  export const description = 'Four-digit security PIN rendered as masked segments.';
  export const component = 'pin-input';
</script>

<script lang="ts">
  import { PinInput } from '@lostgradient/cinder/pin-input';
  let pin = $state('');
</script>

<PinInput id="masked-pin" bind:value={pin} length={4} masked label="Security PIN" />
