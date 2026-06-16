<script lang="ts" module>
  export const title = 'Disabled toggle';
  export const description =
    'A disabled switch is dimmed and non-interactive — clicks and keyboard activation are ignored while the visible label keeps it readable.';
</script>

<script lang="ts">
  import { Toggle } from '@lostgradient/cinder/toggle';
</script>

<Toggle id="beta-features" checked={false} label="Beta features" disabled />
