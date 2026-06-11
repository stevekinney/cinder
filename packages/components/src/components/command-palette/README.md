# CommandPalette

Modal search overlay for keyboard-first commands, destinations, and record jumpers.

## Usage

```svelte
<script lang="ts">
  import CommandPalette from '@lostgradient/cinder/command-palette';
</script>

<CommandPalette />
```

## Grouped Results

Command items register with the palette by DOM node, so grouped results can use valid nested list markup without changing keyboard navigation. Use a presentational outer list item, an inner `ul[role="group"]` with an accessible name, and `CommandItem` children inside that inner list.

```svelte
<CommandPalette bind:open label="Command palette">
  {#snippet items()}
    <li role="presentation" class="cinder-command-group">
      <span class="cinder-command-group__label">Recent files</span>
      <ul role="group" aria-label="Recent files">
        <CommandItem value="roadmap" onselect={() => openRoadmap()}>Roadmap</CommandItem>
        <CommandItem value="settings" onselect={() => openSettings()}>Settings</CommandItem>
      </ul>
    </li>
  {/snippet}
</CommandPalette>
```

## Props

<!-- generated:props:start -->

| Prop          | Type       | Required | Default | Description                                                                                                                                                                                                                                         |
| ------------- | ---------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`   | no       | —       | Class merged onto the palette panel.                                                                                                                                                                                                                |
| `label`       | `string`   | no       | —       | Accessible name for the dialog, wired via `aria-label`.                                                                                                                                                                                             |
| `open`        | `boolean`  | yes      | —       | Bindable open state. The component mutates `open = false` on Escape, backdrop click, or any explicit close path, then fires `onclose`.                                                                                                              |
| `placeholder` | `string`   | no       | —       | Placeholder rendered inside the search input.                                                                                                                                                                                                       |
| `query`       | `string`   | no       | —       | Bindable search query. Mutated by the input's oninput handler. Exposed to the items snippet so consumers can filter. Note: query is NOT reset on close — consumers who want a fresh query on each open should reset it in their `onclose` callback. |
| `empty`       | `(opaque)` | no       | —       | Rendered when zero items are registered after filtering. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                 |
| `footer`      | `(opaque)` | no       | —       | Optional footer, e.g. for keybinding hints. Not part of the listbox. Not expressible in JSON Schema; see the component types for the signature.                                                                                                     |
| `items`       | `(opaque)` | yes      | —       | Receives the current query so consumers can filter. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                      |
| `onclose`     | `(opaque)` | no       | —       | Fired after any close path routed through the palette close lifecycle. Not expressible in JSON Schema; see the component types for the signature.                                                                                                   |
| `triggerRef`  | `(opaque)` | no       | —       | Element to restore focus to on close. Falls back to `captureFocus()`. Not expressible in JSON Schema; see the component types for the signature.                                                                                                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
