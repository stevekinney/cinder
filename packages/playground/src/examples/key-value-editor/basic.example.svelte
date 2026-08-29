<script lang="ts" module>
  export const title = 'Basic key-value editor';
  export const description = 'Edit a small set of environment-style key-value entries.';
</script>

<script lang="ts">
  import { KeyValueEditor } from '@lostgradient/cinder/key-value-editor';
  let entries = $state([
    { key: 'HOST', value: 'localhost' },
    { key: 'PORT', value: '3000' },
  ]);
</script>

<KeyValueEditor bind:entries />
