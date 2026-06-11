# ShortcutHint

Inline shortcut hint that renders a key combo via Kbd alongside an action label, with an accessible text representation not reliant on visual keycaps alone.

## Usage

```svelte
<script lang="ts">
  import { ShortcutHint } from '@lostgradient/cinder/shortcut-hint';
</script>
```

## Guidance

### Use When

- Showing a keyboard shortcut inline beside a label in a toolbar button, menu item, or tooltip.
- Pairing with command-palette items to surface available shortcuts.

### Avoid When

- Displaying a full shortcut reference table — use keyboard-shortcuts instead.

## Props

<!-- generated:props:start -->

| Prop           | Type                    | Required | Default   | Description                                                                                                                                                           |
| -------------- | ----------------------- | -------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`        | `string`                | no       | —         | Additional class names merged with `.cinder-shortcut-hint`.                                                                                                           |
| `keys`         | `string`[]              | yes      | —         | The key sequence to display.                                                                                                                                          |
| `keysLabel`    | `string`                | no       | —         | Accessible label for the key combo.                                                                                                                                   |
| `keysPosition` | `"before"` \| `"after"` | no       | `"after"` | Position of keys relative to children.                                                                                                                                |
| `children`     | `(opaque)`              | no       | —         | The action label rendered beside the keys. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
