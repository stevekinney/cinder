# Card

Surface container for grouping related content and actions into a distinct visual unit.

## Usage

```svelte
<script lang="ts">
  import Card from '@lostgradient/cinder/card';
</script>

<Card>
  <div
    style="min-block-size: 8rem; border: 1px dashed var(--cinder-border-muted); border-radius: var(--cinder-radius-sm); background: repeating-linear-gradient(-45deg, transparent, transparent 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5rem, color-mix(in oklch, var(--cinder-border-muted), transparent 70%) 0.5625rem);"
  ></div>
</Card>
```

## Danger Zones

Use `tone="danger"` when a settings section or action group has destructive, irreversible, or broad-scope consequences. The tone paints the Card container, border, and generated title icon so applications do not need to hand-roll danger-zone borders or backgrounds. Put the concrete state or action in the body and use `ConfirmDialog` for irreversible or workspace-wide changes.

## Elevation

The `elevation` prop applies across every `variant` and `tone` combination, including `variant="well"` and `tone="danger"`. Those two surfaces ship flat (`box-shadow: none`) only at the default `elevation="sm"`, matching their existing look — set `elevation="md"` or `elevation="lg"` explicitly on a well or danger card to raise it above that flat baseline.

## Interaction States

A card becomes interactive when it receives `href` (the whole card renders as an anchor) or `onclick` (the whole card renders as a `<div>` with a stretched hit-target `<button>` covering it). Either way, hover raises the card's elevation and darkens its border under a hover-capable pointer, and keyboard focus paints a visible ring on the outer card itself — never only on the inner control — so the whole-card-is-a-link pattern gets a correct focus indicator without a consumer needing to do anything extra.

## Props

<!-- generated:props:start -->

| Prop                 | Type                                   | Required | Default | Description                                                                                                                                 |
| -------------------- | -------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `bodyTone`           | `"default"` \| `"muted"`               | no       | —       | Body surface treatment. `muted` renders a grey/inset body region.                                                                           |
| `class`              | `string`                               | no       | —       | Custom class merged with `.cinder-card`.                                                                                                    |
| `description`        | `string`                               | no       | —       | Optional subheading rendered as a paragraph below the title inside the header.                                                              |
| `edgeToEdgeOnMobile` | `boolean`                              | no       | —       | Remove side borders/radius and bleed to the viewport edge on narrow screens.                                                                |
| `elevation`          | `"none"` \| `"sm"` \| `"md"` \| `"lg"` | no       | —       | Elevation shadow applied to the card surface.                                                                                               |
| `footerTone`         | `"default"` \| `"muted"`               | no       | —       | Footer surface treatment. `muted` renders a grey/inset footer region.                                                                       |
| `headingLevel`       | `2` \| `3` \| `4` \| `5` \| `6`        | no       | —       | Heading level for the generated title. Defaults to `3`. Set this so the card title nests correctly within the surrounding document outline. |
| `href`               | `string`                               | no       | —       | Destination URL that makes the entire card an anchor.                                                                                       |
| `padding`            | `"none"` \| `"default"`                | no       | —       | Body padding. `none` leaves header and footer padding intact while making body content flush with the card edges.                           |
| `title`              | `string`                               | no       | —       | Primary heading text rendered inside the card's header region.                                                                              |
| `tone`               | `"default"` \| `"danger"`              | no       | —       | Container risk treatment. `danger` renders a danger-zone surface for high-risk settings or destructive actions.                             |
| `variant`            | `"card"` \| `"well"`                   | no       | —       | Visual container style. `card` is raised; `well` is flatter and inset.                                                                      |
| `children`           | `(opaque)`                             | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                  |
| `footer`             | `(opaque)`                             | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                  |
| `header`             | `(opaque)`                             | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                  |
| `onclick`            | `(opaque)`                             | no       | —       | Click handler that makes the entire card a button. Not expressible in JSON Schema; see the component types for the signature.               |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-card-mobile-bleed`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
