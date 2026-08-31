# KeyValueEditor

`KeyValueEditor` edits repeatable string key/value pairs. Pass `secret(key)` to render sensitive values in an editable password `Input`.

```svelte
<KeyValueEditor bind:entries secret={(key) => key.toLowerCase().includes('token')} />
```

The component owns row addition, removal, and change reporting. The consumer owns key validation and the policy that determines which keys are secret.

## Usage

```svelte
<script lang="ts">
  import { KeyValueEditor } from '@lostgradient/cinder/key-value-editor';
  let entries = $state([
    { key: 'HOST', value: 'localhost' },
    { key: 'PORT', value: '3000' },
  ]);
</script>

<KeyValueEditor bind:entries />
```
