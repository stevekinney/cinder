# Card

Surface container for grouping related content and actions into a distinct visual unit.

## Usage

```svelte
<script lang="ts">
  import Card from '@lostgradient/cinder/card';
</script>

<Card />
```

## Props

<!-- generated:props:start -->

| Prop                 | Type                            | Required | Default | Description                                                                                                                                 |
| -------------------- | ------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `bodyTone`           | `"default"` \| `"muted"`        | no       | —       | Body surface treatment. `muted` renders a grey/inset body region.                                                                           |
| `description`        | `string`                        | no       | —       |                                                                                                                                             |
| `edgeToEdgeOnMobile` | `boolean`                       | no       | —       | Remove side borders/radius and bleed to the viewport edge on narrow screens.                                                                |
| `footerTone`         | `"default"` \| `"muted"`        | no       | —       | Footer surface treatment. `muted` renders a grey/inset footer region.                                                                       |
| `headingLevel`       | `2` \| `3` \| `4` \| `5` \| `6` | no       | —       | Heading level for the generated title. Defaults to `3`. Set this so the card title nests correctly within the surrounding document outline. |
| `title`              | `string`                        | no       | —       |                                                                                                                                             |
| `variant`            | `"card"` \| `"well"`            | no       | —       | Visual container style. `card` is raised; `well` is flatter and inset.                                                                      |
| `children`           | `(opaque)`                      | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                  |
| `class`              | `(opaque)`                      | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                     |
| `footer`             | `(opaque)`                      | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                  |
| `header`             | `(opaque)`                      | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                  |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-card-mobile-bleed`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
