<script lang="ts" module>
  export const title = 'With reveal toggle';
  export const description =
    'Optional reveal/hide toggle for settings pages where the consumer explicitly enables it.';
</script>

<script lang="ts">
  import { SecretValueField } from '@lostgradient/cinder/secret-value-field';
</script>

<SecretValueField
  value="example_whsec_a1b2c3d4e5f6g7h8i9j0k1l2m3n4"
  label="Webhook Secret"
  prefix="example_whsec_"
  allowReveal={true}
/>
