<script lang="ts" module>
  export const title = 'Masked API key';
  export const description =
    'Default masked display for an existing API key. The secret value is never rendered in attributes.';
</script>

<script lang="ts">
  import { SecretValueField } from '@lostgradient/cinder/secret-value-field';
</script>

<SecretValueField
  value="example_live_a1b2c3d4e5f6g7h8i9j0k1l2"
  label="API Key"
  prefix="example_live_"
  suffix="l2m3"
/>
