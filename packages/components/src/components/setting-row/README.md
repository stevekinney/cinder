# SettingRow

SettingRow arranges settings-page guidance and a control while publishing FormField context to composed Input, Toggle, or Select controls. It supports advisory, error, managed-policy, and optional disclosure content without duplicating those semantics at each call site.

## Usage

```svelte
<script lang="ts">
  import { Input } from '@lostgradient/cinder';
  import { SettingRow } from '@lostgradient/cinder';
</script>

<SettingRow id="display-name" label="Display name" description="Shown to collaborators.">
  {#snippet control()}
    <Input id="display-name" value="" placeholder="Ada Lovelace" />
  {/snippet}
</SettingRow>
```

`SettingRow` requires a stable `id`, `label`, and `control` snippet. `warning` is advisory and `error` is corrective; `FormField` renders both messages itself as siblings of the control, and exposes only `warningId`/`errorId`/`describedBy`/`invalid` through context—a custom `control` that reads that context associates with the messages, it doesn't receive their text. Use `managed` with [`PolicyLock`](../policy-lock/README.md) when a policy owns the value. The row does not save settings or disable a control automatically—pass `disabled` to the row or control when the host is submitting or unavailable.

## Props

<!-- generated:props:start -->

| Prop          | Type                                 | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ------------------------------------ | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`                             | no       | —       | Additional class merged with the component's root class.                                                                                                                                                                                                                                                                                                                                                                                     |
| `description` | `string`                             | no       | —       | Guidance text describing the setting.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `disabled`    | `boolean`                            | no       | `false` | Forwards a disabled state into `FormField` context for the row's control. Only takes effect for a control that opts into and reads that context—a native element or a third-party component that doesn't consume it stays interactive and must receive `disabled` directly. Does not disable automatically while saving. `SettingRow` forwards `undefined` when omitted; `FormField` normalizes that to `false`. Defaults to `false`.        |
| `error`       | `string`                             | no       | —       | Corrective error message. `FormField` renders this text itself, as a sibling of the control, not through context—a custom `control` that reads `FormField` context sees only the derived `errorId`, `invalid`, and the composed `describedBy`, never the message string itself.                                                                                                                                                              |
| `id`          | `string`                             | yes      | —       | Stable id forwarded into `FormField` context, which associates the generated `<label for={id}>` with it. Only a control that opts into and reads that context receives `id` automatically—for a native element or a third-party component that doesn't, the label is unassociated unless the host also applies `id` to that control directly, the same qualification as `required` and `disabled`.                                           |
| `label`       | `string`                             | yes      | —       | Visible setting label.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `managed`     | { by?: `string`; reason?: `string` } | no       | —       | Renders a managed-policy indicator; pair with `PolicyLock`.                                                                                                                                                                                                                                                                                                                                                                                  |
| `required`    | `boolean`                            | no       | `false` | Renders the required marker and forwards `required` into `FormField` context. Only takes effect for a control that opts into and reads that context—it never adds a native `required` attribute, so a control that doesn't consume the context still passes browser constraint validation and must receive `required` directly. `SettingRow` forwards `undefined` when omitted; `FormField` normalizes that to `false`. Defaults to `false`. |
| `warning`     | `string`                             | no       | —       | Advisory message. `FormField` renders this text itself, as a sibling of the control, not through context—a custom `control` that reads `FormField` context sees only the derived `warningId` (and the composed `describedBy`) to associate with, never the message string itself.                                                                                                                                                            |
| `control`     | `(opaque)`                           | yes      | —       | The setting's control, rendered with `FormField` context applied. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                 |
| `disclosure`  | `(opaque)`                           | no       | —       | Optional disclosure content rendered beneath the row. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.
<!-- generated:variables:end -->
