# Carousel

Composable slide rotator with controls, indicators, keyboard support, and optional autoplay.

## Usage

```svelte
<script lang="ts">
  import { Carousel } from '@lostgradient/cinder/carousel';

  const slides = [
    { id: 'one', label: 'Welcome', title: 'Welcome', description: 'Start here' },
    { id: 'two', label: 'Features', title: 'Features', description: 'What is included' },
  ];
</script>

<Carousel {slides} autoplay />
```

## Props

<!-- generated:props:start -->

| Prop               | Type       | Required | Default | Description                                                                                                         |
| ------------------ | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `activeIndex`      | `number`   | no       | —       | Zero-based active index (bindable).                                                                                 |
| `autoplay`         | `boolean`  | no       | —       | Enables interval-based auto-advance.                                                                                |
| `autoplayInterval` | `number`   | no       | —       | Milliseconds between auto-advance ticks.                                                                            |
| `class`            | `string`   | no       | —       | Additional classes merged onto the root element.                                                                    |
| `description`      | `string`   | no       | —       | Optional accessible description linked to the region.                                                               |
| `label`            | `string`   | no       | —       | Accessible name for the carousel region.                                                                            |
| `controlLabels`    | `(opaque)` | no       | —       | Override labels for controls and picker. Not expressible in JSON Schema; see the component types for the signature. |
| `slides`           | `(opaque)` | yes      | —       | Ordered list of slides. Not expressible in JSON Schema; see the component types for the signature.                  |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->
