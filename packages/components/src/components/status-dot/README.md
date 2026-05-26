# Status Dot

A semantic status indicator that pairs a colored dot with an accessible label.

## Usage

```svelte
<script lang="ts">
  import StatusDot from 'cinder/status-dot';
</script>

<StatusDot status="online" label="Online" />
```

## Props

<!-- generated:props:start -->

| Prop        | Type                                                                                | Required | Default | Description                                                                                              |
| ----------- | ----------------------------------------------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------- |
| `class`     | `string`                                                                            | no       | —       | Extra classes appended to the root element.                                                              |
| `label`     | `string`                                                                            | no       | —       | Optional human label. Rendered visibly when `showLabel` is true; used as the accessible name either way. |
| `showLabel` | `boolean`                                                                           | no       | `true`  | Whether to render the visible label.                                                                     |
| `size`      | `"sm"` \| `"md"`                                                                    | no       | `"md"`  | Dot size.                                                                                                |
| `status`    | `"online"` \| `"offline"` \| `"warning"` \| `"error"` \| `"pending"` \| `"neutral"` | yes      | —       | Required semantic status. Drives color via `data-cinder-status`.                                         |

<!-- generated:props:end -->

## Breaking changes

The `"building"` status was renamed to `"pending"`. Update any usage:

```svelte
<!-- before -->
<StatusDot status="building" label="Deploying" />
<!-- after -->
<StatusDot status="pending" label="Deploying" />
```

The dot color is unchanged (still info-blue) — only the status token name changed.

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-status-dot-color`
- `--cinder-status-dot-size`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

<!-- generated:subcomponents:end -->
