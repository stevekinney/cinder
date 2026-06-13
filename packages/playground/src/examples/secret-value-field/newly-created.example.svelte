<script lang="ts" module>
  export const title = 'Newly-created secret';
  export const description =
    'One-time reveal for a newly-created API key. The value is shown on first render with a warning to copy it now.';
</script>

<script lang="ts">
  import { SecretValueField } from '@lostgradient/cinder/secret-value-field';
</script>

<SecretValueField
  value="example_live_a1b2c3d4e5f6g7h8i9j0k1l2"
  label="API Key"
  prefix="example_live_"
  initiallyRevealed={true}
  copiedLabel="API key copied"
>
  {#snippet warning()}
    Copy this key now — it will not be shown again.
  {/snippet}
</SecretValueField>
