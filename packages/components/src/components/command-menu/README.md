# CommandMenu

Inline caret-anchored slash-command list for textareas and single-line text inputs.

## Usage

```svelte
<script lang="ts">
  import { CommandMenu } from '@lostgradient/cinder/command-menu';
</script>
```

## Guidance

### Use When

- Showing a contextual command list at the caret while a user types in a textarea or input.
- Building slash-command insertion flows where the host owns text replacement.

### Avoid When

- Exposing a global app launcher — use command-palette instead.
- Selecting from a static form option list — use combobox instead.

## Props

<!-- generated:props:start -->

| Prop            | Type                                                                                                                 | Required | Default | Description                                                                                                                                                                                                                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `caretIndex`    | `number`                                                                                                             | no       | —       | Caret offset within the anchor value. Optional — when omitted, it's derived from the anchor's live `selectionEnd`. Consumers that already track trigger-relative caret state (e.g. from `detectTrigger`) may keep passing it explicitly; the derivation exists for hosts that don't need anything more precise than "where the caret currently is." |
| `class`         | `string`                                                                                                             | no       | —       | Class merged with `.cinder-command-menu`.                                                                                                                                                                                                                                                                                                           |
| `label`         | `string`                                                                                                             | no       | —       | Accessible listbox label. Default `'Commands'`.                                                                                                                                                                                                                                                                                                     |
| `listboxId`     | `string`                                                                                                             | no       | —       | Stable listbox id. Defaults to a generated component id.                                                                                                                                                                                                                                                                                            |
| `offset`        | `number`                                                                                                             | no       | —       | Distance in px between the caret and menu. Default `6`.                                                                                                                                                                                                                                                                                             |
| `open`          | `boolean`                                                                                                            | no       | —       | Open state. Bindable. Default `false`.                                                                                                                                                                                                                                                                                                              |
| `placement`     | `"top"` \| `"bottom"` \| `"left"` \| `"right"` \| `"top-start"` \| `"top-end"` \| `"bottom-start"` \| `"bottom-end"` | no       | —       | Caret-relative placement. Default `'bottom-start'`.                                                                                                                                                                                                                                                                                                 |
| `query`         | `string`                                                                                                             | no       | —       | Query text after the trigger character. Bindable. Default `''`.                                                                                                                                                                                                                                                                                     |
| `anchor`        | `(opaque)`                                                                                                           | yes      | —       | Text field used as the caret-position anchor. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                            |
| `empty`         | `(opaque)`                                                                                                           | no       | —       | Optional empty state rendered after item registration settles. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                           |
| `items`         | `(opaque)`                                                                                                           | yes      | —       | Render command items for the current query. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                              |
| `onComplete`    | `(opaque)`                                                                                                           | no       | —       | Invoked when the user accepts inline ghost-text completion. Passing this prop is what enables the feature — omit it and no ghost text ever renders. See `command-menu.a11y.md` for the full keyboard model. Not expressible in JSON Schema; see the component types for the signature.                                                              |
| `onDismiss`     | `(opaque)`                                                                                                           | no       | —       | Invoked when Escape or outside pointerdown dismisses the menu. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                           |
| `onSelect`      | `(opaque)`                                                                                                           | no       | —       | Invoked when an enabled command is activated. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                            |
| `onStateChange` | `(opaque)`                                                                                                           | no       | —       | One-way state output for host-owned field ARIA. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                          |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
