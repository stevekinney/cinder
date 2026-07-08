# Card

Surface container for grouping related content and actions into a distinct visual unit.

## Usage

```svelte
<script lang="ts">
  import Card from '@lostgradient/cinder/card';
</script>

<Card />
```

## Danger Zones

Use `tone="danger"` when a settings section or action group has destructive, irreversible, or broad-scope consequences. The tone paints the Card container, border, and generated title icon so applications do not need to hand-roll danger-zone borders or backgrounds. Put the concrete state or action in the body and use `ConfirmDialog` for irreversible or workspace-wide changes.

## Props

<!-- generated:props:start -->

| Prop                 | Type                            | Required | Default | Description                                                                                                                                 |
| -------------------- | ------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `bodyTone`           | `"default"` \| `"muted"`        | no       | —       | Body surface treatment. `muted` renders a grey/inset body region.                                                                           |
| `description`        | `string`                        | no       | —       | Optional subheading rendered as a paragraph below the title inside the header.                                                              |
| `edgeToEdgeOnMobile` | `boolean`                       | no       | —       | Remove side borders/radius and bleed to the viewport edge on narrow screens.                                                                |
| `footerTone`         | `"default"` \| `"muted"`        | no       | —       | Footer surface treatment. `muted` renders a grey/inset footer region.                                                                       |
| `headingLevel`       | `2` \| `3` \| `4` \| `5` \| `6` | no       | —       | Heading level for the generated title. Defaults to `3`. Set this so the card title nests correctly within the surrounding document outline. |
| `padding`            | `"none"` \| `"default"`         | no       | —       | Region padding. `none` removes body, header, and footer padding for flush or full-bleed content (e.g. an image).                            |
| `title`              | `string`                        | no       | —       | Primary heading text rendered inside the card's header region.                                                                              |
| `tone`               | `"default"` \| `"danger"`       | no       | —       | Container risk treatment. `danger` renders a danger-zone surface for high-risk settings or destructive actions.                             |
| `variant`            | `"card"` \| `"well"`            | no       | —       | Visual container style. `card` is raised; `well` is flatter and inset.                                                                      |
| `children`           | `(opaque)`                      | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                  |
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
