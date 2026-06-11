# Alert

A status message that communicates contextual feedback and can optionally be dismissed.

## Usage

```svelte
<script lang="ts">
  import Alert from '@lostgradient/cinder/alert';
</script>

<Alert variant="success">Saved successfully.</Alert>
```

## Props

<!-- generated:props:start -->

| Prop          | Type                                                              | Required | Default  | Description                                                                                                                |
| ------------- | ----------------------------------------------------------------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`                                                          | no       | —        | Custom class merged with `.cinder-alert`.                                                                                  |
| `dismissible` | `boolean`                                                         | no       | `false`  | Allow the alert to be dismissed.                                                                                           |
| `variant`     | `"info"` \| `"success"` \| `"warning"` \| `"error"` \| `"danger"` | no       | `"info"` | Visual style. `danger` is an accepted alias for `error` — both render identically.                                         |
| `children`    | `(opaque)`                                                        | yes      | —        | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `icon`        | `(opaque)`                                                        | no       | —        | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onDismiss`   | `(opaque)`                                                        | no       | —        | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-alert-info`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

<!-- generated:subcomponents:end -->
