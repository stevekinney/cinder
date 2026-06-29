# Marquee

Render continuously looping horizontal or vertical ticker content with pause and reduced-motion safeguards.

## Usage

```svelte
<script lang="ts">
  import { Marquee } from '@lostgradient/cinder/marquee';
</script>

<Marquee label="Announcements">
  {#snippet children()}
    <span>New release is live</span>
    <span>•</span>
    <span>Check the changelog for details</span>
  {/snippet}
</Marquee>
```

## Props

<!-- generated:props:start -->

| Prop           | Type                           | Required | Default        | Description                                                                                          |
| -------------- | ------------------------------ | -------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| `class`        | `string`                       | no       | —              | Custom class merged with `.cinder-marquee`.                                                          |
| `direction`    | `"horizontal"` \| `"vertical"` | no       | `"horizontal"` | Scroll direction for the looping track.                                                              |
| `duration`     | `string`                       | no       | `"24s"`        | Animation duration for one complete loop (valid CSS time).                                           |
| `gap`          | `string`                       | no       | `"1.5rem"`     | Gap between repeated items (valid CSS length).                                                       |
| `label`        | `string`                       | no       | —              | Accessible region label for the marquee container.                                                   |
| `pauseOnFocus` | `boolean`                      | no       | `true`         | Pause animation while any child is focused.                                                          |
| `pauseOnHover` | `boolean`                      | no       | `true`         | Pause animation while hovered (pointer-capable devices).                                             |
| `children`     | `(opaque)`                     | yes      | —              | Rendered marquee content. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-marquee-duration`
- `--cinder-marquee-gap`
- `--cinder-marquee-play-state`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
