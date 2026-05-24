# Transition

Coordinates enter and exit lifecycles either with CSS-driven presence state or with a Svelte transition function.

## Usage

```svelte
<script lang="ts">
  import Transition from 'cinder/transition';
</script>

<Transition show={true}>
  <div>Animated content</div>
</Transition>
```

## Props

<!-- generated:props:start -->

| Prop                   | Type       | Required | Default | Description         |
| ---------------------- | ---------- | -------- | ------- | ------------------- |
| `class`                | `string`   | no       | —       |                     |
| `show`                 | `boolean`  | yes      | —       |                     |
| `transition`           | `(opaque)` | —        | —       | function-or-snippet |
| `transitionParameters` | `(opaque)` | —        | —       | unknown-shape       |

<!-- generated:props:end -->

`Transition` also accepts a Svelte-compatible `transition` function and matching
`transitionParameters`. `Presence` accepts `present`, `forceMount`, and
`onExitComplete` for CSS-driven mount and unmount coordination.

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
