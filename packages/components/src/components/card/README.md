# Card

A Card component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Card from 'cinder/card';
</script>

<Card />
```

## Props

<!-- generated:props:start -->

| Prop                 | Type                     | Required | Default | Description                                                                  |
| -------------------- | ------------------------ | -------- | ------- | ---------------------------------------------------------------------------- |
| `bodyTone`           | `"default"` \| `"muted"` | no       | —       | Body surface treatment. `muted` renders a grey/inset body region.            |
| `description`        | `string`                 | no       | —       |                                                                              |
| `edgeToEdgeOnMobile` | `boolean`                | no       | —       | Remove side borders/radius and bleed to the viewport edge on narrow screens. |
| `footerTone`         | `"default"` \| `"muted"` | no       | —       | Footer surface treatment. `muted` renders a grey/inset footer region.        |
| `title`              | `string`                 | no       | —       |                                                                              |
| `variant`            | `"card"` \| `"well"`     | no       | —       | Visual container style. `card` is raised; `well` is flatter and inset.       |
| `children`           | `(opaque)`               | —        | —       | function-or-snippet                                                          |
| `class`              | `(opaque)`               | —        | —       | unknown-shape                                                                |
| `footer`             | `(opaque)`               | —        | —       | function-or-snippet                                                          |
| `header`             | `(opaque)`               | —        | —       | function-or-snippet                                                          |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-card-mobile-bleed`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
