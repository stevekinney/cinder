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

| Prop    | Type      | Required | Default | Description |
| ------- | --------- | -------- | ------- | ----------- |
| `class` | `string`  | no       | —       |             |
| `show`  | `boolean` | yes      | —       |             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
