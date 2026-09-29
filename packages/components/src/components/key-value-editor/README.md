# KeyValueEditor

`KeyValueEditor` edits repeatable string key/value pairs. Pass `secret(key)` to render sensitive values in an editable password `Input`.

```svelte
<KeyValueEditor bind:entries secret={(key) => key.toLowerCase().includes('token')} />
```

The component owns row addition, removal, and change reporting. The consumer owns key validation and the policy that determines which keys are secret.

## Usage

```svelte
<script lang="ts">
  import { KeyValueEditor } from '@lostgradient/cinder';
  let entries = $state([
    { id: 'host', key: 'HOST', value: 'localhost' },
    { id: 'port', key: 'PORT', value: '3000' },
  ]);
</script>

<KeyValueEditor bind:entries />
```

`entries` is the editable list; `onValueChange` is the callback form when the parent does not use a binding. The editor adds and removes rows and reports the resulting array, but it does not validate key syntax, deduplicate names, or persist changes. Supply `secret={(key) => ...}` to route matching values through a password input; the predicate receives the key only, so that callback does not receive the secret value or a policy object.

Each row's `id` is an immutable identity, independent of its editable `key`/`value` text — it must be unique within one editor's `entries`, but two rows may otherwise share equal key/value text. Consumers own minting `id` for the rows they supply (e.g. `crypto.randomUUID()`); the editor mints its own `id` for a row added through "Add pair". Keying rows by `id` (not position) lets a parent reorder, insert, or remove other rows without disturbing a row's focused input.

Give `addLabel` and `removeLabel` concrete action wording when the surrounding page has more than one editor. If a value fails validation or saving, keep the row and its text in the list so the user can correct it instead of treating a rejected update as a deletion.

## Props

<!-- generated:props:start -->

| Prop            | Type       | Required | Default      | Description                                                                                                                                                                                                                                                                                                                                |
| --------------- | ---------- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `addLabel`      | `string`   | no       | `"Add pair"` | Label for the add-row action. Give it concrete wording when more than one editor is on the page. Defaults to `'Add pair'`.                                                                                                                                                                                                                 |
| `class`         | `string`   | no       | —            | Additional class merged with the component's root class.                                                                                                                                                                                                                                                                                   |
| `entries`       | `(opaque)` | no       | —            | The editable list of key/value rows. Bindable. Defaults to `[]`. (`KeyValueEntry` is not expressible in JSON Schema, so this default only appears here in prose.) Not expressible in JSON Schema; see the component types for the signature.                                                                                               |
| `onValueChange` | `(opaque)` | no       | —            | Callback form of the resulting array, for when the parent does not use `bind:entries`. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                          |
| `removeLabel`   | `(opaque)` | no       | —            | Label for a row's remove action, given that row's key. Give it concrete wording when more than one editor is on the page. Defaults to `` (key) => `Remove ${key \|\| 'pair'}` ``—an empty key (a newly added, not-yet-named row) falls back to `'Remove pair'`. Not expressible in JSON Schema; see the component types for the signature. |
| `secret`        | `(opaque)` | no       | —            | Predicate receiving a row's key; routes that row's value through a password input when it returns `true`. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                       |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.
<!-- generated:variables:end -->
