# Tabs

A Tabs component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Tabs from 'cinder/tabs';
</script>

<Tabs />
```

## Props

<!-- generated:props:start -->

| Prop              | Type                           | Required | Default | Description                                                                                                                                                                                                   |
| ----------------- | ------------------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activateOnFocus` | `boolean`                      | no       | —       | When true (default for horizontal), focusing a tab also activates it (the panel updates immediately). Vertical defaults to manual activation — the user moves focus with arrows, then presses Enter or Space. |
| `class`           | `string`                       | no       | —       | Additional class names merged with `.cinder-tabs`.                                                                                                                                                            |
| `orientation`     | `"horizontal"` \| `"vertical"` | no       | —       | Layout orientation. Affects which arrow keys move between tabs.                                                                                                                                               |
| `value`           | `string`                       | no       | —       | Bound active tab value.                                                                                                                                                                                       |
| `children`        | `(opaque)`                     | —        | —       | function-or-snippet                                                                                                                                                                                           |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
