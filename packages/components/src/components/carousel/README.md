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

> **`loop` defaults to `false`.** `Previous`/`Next` clamp and disable at the
> ends instead of wrapping. Set `loop` to wrap past the first/last slide.
> Wrapping is seamless only for the **first** cycle through the deck —
> `slides` is rendered in a rotated physical order (via CSS `order`) starting
> from the initial `activeIndex`, so the first wrap navigation lines up with
> an adjacent physical slide. Repeated wraps after that reuse the same
> rotated order and are not guaranteed to be adjacent, so they animate as a
> longer traversal rather than a single seamless step.

> **`slidesPerView` and `loop` are mutually exclusive.** Setting
> `slidesPerView` above `1` while `loop` is also set logs a dev warning and
> ignores `loop` — wrapping a multi-slide range across the physical-order
> rotation boundary would leave a partial-width gap. `slidesPerView` above
> `1` also widens the _active_ range: more than one slide is non-`inert` at
> once, and the live region announces `"Slides N–M of Total"` instead of a
> single labelled slide. See `carousel.a11y.md` for the full review.

```svelte
<!-- Peek layout: 1.2 slides visible, hinting at the next one -->
<Carousel {slides} slidesPerView={1.2} gap="1rem" />
```

> **Mouse users get click-and-drag scrolling, with momentum, automatically.**
> On a fine pointer (`(hover: hover) and (pointer: fine)`) with
> `prefers-reduced-motion` off, clicking and dragging the track scrolls it
> with the same physics a released swipe would have, snapping to the
> nearest slide on release. There is no prop to opt out per-instance today —
> it degrades automatically under reduced motion, and never engages for
> touch or pen (they already pan the native scroller directly). See
> `carousel.a11y.md` for the full review.

## Props

<!-- generated:props:start -->

| Prop               | Type                                | Required | Default | Description                                                                                                                                                                                                                                                                             |
| ------------------ | ----------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeIndex`      | `number`                            | no       | —       | Zero-based active index (bindable).                                                                                                                                                                                                                                                     |
| `align`            | `"start"` \| `"center"`             | no       | —       | Snap alignment of the active slide(s) within the viewport. Default `'start'`.                                                                                                                                                                                                           |
| `autoplay`         | `boolean`                           | no       | —       | Enables interval-based auto-advance.                                                                                                                                                                                                                                                    |
| `autoplayInterval` | `number`                            | no       | —       | Milliseconds between auto-advance ticks.                                                                                                                                                                                                                                                |
| `class`            | `string`                            | no       | —       | Additional classes merged onto the root element.                                                                                                                                                                                                                                        |
| `description`      | `string`                            | no       | —       | Optional accessible description linked to the region.                                                                                                                                                                                                                                   |
| `gap`              | `string`                            | no       | —       | Gap between slides, as a CSS length (e.g. `'1rem'`). Only applied when `slidesPerView` is not `1`.                                                                                                                                                                                      |
| `indicatorLimit`   | `number`                            | no       | —       | Slide count above which the auto-resolved picker switches to a counter. Default `8`.                                                                                                                                                                                                    |
| `indicators`       | `"dots"` \| `"counter"` \| `"none"` | no       | —       | How the slide picker is rendered. `'dots'` below `indicatorLimit` degrades automatically to `'counter'` above it when left unset.                                                                                                                                                       |
| `label`            | `string`                            | no       | —       | Accessible name for the carousel region.                                                                                                                                                                                                                                                |
| `loop`             | `boolean`                           | no       | —       | Wraps navigation past the first/last slide back around. Default `false`: `Previous`/`Next` clamp and disable at the ends instead of wrapping.                                                                                                                                           |
| `slidesPerView`    | `number` \| `"auto"`                | no       | —       | How many slides are visible at once. A fraction (e.g. `1.2`) peeks the next slide. `'auto'` lets each slide size itself via its own CSS. Default `1`. Not supported together with `loop` — `loop` is ignored (with a dev warning) while this is set above `1`.                          |
| `controlLabels`    | `(opaque)`                          | no       | —       | Override labels for controls and picker. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                     |
| `onSlideChange`    | `(opaque)`                          | no       | —       | Called after the active slide changes as a result of the carousel's own navigation (never for a parent-driven `activeIndex` update). Not expressible in JSON Schema; see the component types for the signature.                                                                         |
| `slide`            | `(opaque)`                          | no       | —       | Renders inside each slide's `<article>`, replacing the built-in image/title/description/link body. `slides` remains the identity and accessible-labeling source of truth — this only replaces slide content. Not expressible in JSON Schema; see the component types for the signature. |
| `slides`           | `(opaque)`                          | yes      | —       | Ordered list of slides. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-carousel-aspect-ratio`
- `--cinder-carousel-dot-size`
- `--cinder-carousel-gap`
- `--cinder-carousel-slide-size`
<!-- generated:variables:end -->
