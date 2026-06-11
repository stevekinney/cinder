# KeyboardShortcuts

Grouped keyboard-shortcut reference that renders key combos via Kbd with accessible labels not reliant only on visual keycaps.

## Usage

```svelte
<script lang="ts">
  import { KeyboardShortcuts } from '@lostgradient/cinder/keyboard-shortcuts';
</script>
```

## Guidance

### Use When

- Displaying a reference panel of keyboard shortcuts grouped by feature area.
- Embedding a shortcut table inside a modal, sheet, popover, or help page.

### Avoid When

- Showing a single inline shortcut hint — use shortcut-hint instead.

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                                                                                                                         |
| ---------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`   | no       | —       | Additional class names merged with `.cinder-keyboard-shortcuts`.                                                                                                    |
| `heading`  | `string`   | no       | —       | Optional heading for the entire shortcuts panel.                                                                                                                    |
| `children` | `(opaque)` | no       | —       | Intro content rendered above the groups. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `groups`   | `(opaque)` | yes      | —       | Groups of shortcuts to display. A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
