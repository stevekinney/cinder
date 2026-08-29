# KeyValueEditor

`KeyValueEditor` edits repeatable string key/value pairs. Pass `secret(key)` to route sensitive values through `SecretValueField` instead of a plain input.

```svelte
<KeyValueEditor bind:entries secret={(key) => key.toLowerCase().includes('token')} />
```

The component owns row addition, removal, and change reporting. The consumer owns key validation and the policy that determines which keys are secret.
