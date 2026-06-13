<script lang="ts" module>
  export const title = 'Multiple keys in a settings list';
  export const description =
    'Multiple masked keys with prefix/suffix metadata, as they would appear in a settings table.';
</script>

<script lang="ts">
  import { SecretValueField } from '@lostgradient/cinder/secret-value-field';
</script>

<div style="display: flex; flex-direction: column; gap: var(--cinder-space-3); max-width: 480px;">
  <SecretValueField
    value="example_live_a1b2c3d4e5f6g7h8i9j0"
    label="Production API Key"
    prefix="example_live_"
    suffix="9j0"
    allowReveal={true}
  />
  <SecretValueField
    value="example_test_x9y8z7w6v5u4t3s2r1q0"
    label="Test API Key"
    prefix="example_test_"
    suffix="1q0"
    allowReveal={true}
  />
</div>
