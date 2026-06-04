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

| Prop          | Type                                                | Required | Default  | Description                               |
| ------------- | --------------------------------------------------- | -------- | -------- | ----------------------------------------- |
| `class`       | `string`                                            | no       | —        | Custom class merged with `.cinder-alert`. |
| `dismissible` | `boolean`                                           | no       | `false`  | Allow the alert to be dismissed.          |
| `variant`     | `"info"` \| `"success"` \| `"warning"` \| `"error"` | no       | `"info"` | Visual style.                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-alert-info`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

<!-- generated:subcomponents:end -->
