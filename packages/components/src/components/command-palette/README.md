# CommandPalette

A CommandPalette component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import CommandPalette from 'cinder/command-palette';
</script>

<CommandPalette />
```

## Props

<!-- generated:props:start -->

| Prop          | Type               | Required | Default | Description                                                                                                                                                                                                                                         |
| ------------- | ------------------ | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`           | no       | —       | Class merged onto the palette panel.                                                                                                                                                                                                                |
| `label`       | `string`           | no       | —       | Accessible name for the dialog, wired via `aria-label`.                                                                                                                                                                                             |
| `open`        | `boolean`          | yes      | —       | Bindable open state. The component mutates `open = false` on Escape, backdrop click, or any explicit close path, then fires `onclose`.                                                                                                              |
| `placeholder` | `string`           | no       | —       | Placeholder rendered inside the search input.                                                                                                                                                                                                       |
| `query`       | `string`           | no       | —       | Bindable search query. Mutated by the input's oninput handler. Exposed to the items snippet so consumers can filter. Note: query is NOT reset on close — consumers who want a fresh query on each open should reset it in their `onclose` callback. |
| `triggerRef`  | `object` \| `null` | no       | —       | Element to restore focus to on close. Falls back to `captureFocus()`.                                                                                                                                                                               |
| `empty`       | `(opaque)`         | —        | —       | function-or-snippet                                                                                                                                                                                                                                 |
| `footer`      | `(opaque)`         | —        | —       | function-or-snippet                                                                                                                                                                                                                                 |
| `items`       | `(opaque)`         | —        | —       | function-or-snippet                                                                                                                                                                                                                                 |
| `onclose`     | `(opaque)`         | —        | —       | function-or-snippet                                                                                                                                                                                                                                 |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
