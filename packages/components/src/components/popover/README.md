# Popover

Non-blocking floating panel anchored to a trigger element for contextual content.

## Usage

```svelte
<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { Popover } from '@lostgradient/cinder/popover';

  let open = $state(false);
  const headingId = 'my-popover-title';
</script>

<Popover bind:open ariaLabelledby={headingId} showArrow focusManagement="preserve">
  {#snippet trigger()}
    <Button label="Open" onclick={() => (open = !open)} />
  {/snippet}

  <h2 id={headingId}>Panel heading</h2>
  <p>Panel content goes here.</p>
</Popover>
```

## When to use

Use Popover for rich, interactive contextual content anchored to a trigger — help panels, color pickers, settings cards, and similar surfaces that do not need to interrupt the user.

| Situation                                           | Reach for                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| Short descriptive hint shown on hover or focus      | `Tooltip`                                                          |
| A list of navigable actions triggered from a button | `Dropdown` (sets `role="menu"`, manages arrow-key navigation)      |
| A combo-box, tag picker, or filterable option list  | `Combobox` (manages `listbox` role, keyboard selection, filtering) |
| Rich content, settings, or any non-menu panel       | **Popover**                                                        |
| Focused task that should block the rest of the page | `Modal`, `Drawer`, or `Sheet`                                      |

### `focusManagement` — `"panel"` vs `"preserve"`

- **`"panel"` (default):** Focus moves to the first focusable element inside the panel when it opens. Use this when the panel contains a form field or search input that needs immediate keyboard access (date pickers, filter panels, inline editors).
- **`"preserve"`:** Focus stays on the trigger after the panel opens. Use this for content-first panels (account settings, help text, status details) where the user is reading, not immediately interacting.

## Props

<!-- generated:props:start -->

| Prop              | Type                                                                                                                 | Required | Default | Description                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ariaLabelledby`  | `string`                                                                                                             | no       | —       | Id of an element labelling the panel. Wins over `label`.                                                                                                                                                                                                                                                                                                |
| `class`           | `string`                                                                                                             | no       | —       | Extra class merged onto `.cinder-popover`.                                                                                                                                                                                                                                                                                                              |
| `closeOnEscape`   | `boolean`                                                                                                            | no       | —       | Whether the Popover registers its own handler on the shared Escape stack. Default `true`. Set `false` when a parent component (e.g. Combobox) owns Escape for the whole interaction and must remain the single, top-most Escape consumer — otherwise both would register and the Popover's handler would shadow the parent's while options are visible. |
| `focusManagement` | `"panel"` \| `"preserve"`                                                                                            | no       | —       | Focus behavior for each open session. Default `'panel'`.                                                                                                                                                                                                                                                                                                |
| `id`              | `string`                                                                                                             | no       | —       | Optional panel id. Defaults to a generated `cinder-popover-*` id.                                                                                                                                                                                                                                                                                       |
| `label`           | `string`                                                                                                             | no       | —       | Accessible name. Sets `aria-label` when `ariaLabelledby` is not supplied.                                                                                                                                                                                                                                                                               |
| `offset`          | `number`                                                                                                             | no       | —       | Distance in px between trigger and panel. Default `8`.                                                                                                                                                                                                                                                                                                  |
| `open`            | `boolean`                                                                                                            | no       | —       | Open state. Bindable. Default `false`.                                                                                                                                                                                                                                                                                                                  |
| `placement`       | `"top"` \| `"bottom"` \| `"left"` \| `"right"` \| `"top-start"` \| `"top-end"` \| `"bottom-start"` \| `"bottom-end"` | no       | —       | Anchor placement. Default `'bottom-start'`.                                                                                                                                                                                                                                                                                                             |
| `role`            | `"dialog"` \| `"group"` \| `"listbox"`                                                                               | no       | —       | ARIA role for the panel. Default `'dialog'`.                                                                                                                                                                                                                                                                                                            |
| `showArrow`       | `boolean`                                                                                                            | no       | —       | Render a directional arrow on the panel. Default `false`.                                                                                                                                                                                                                                                                                               |
| `widthMode`       | `"content"` \| `"match-anchor"` \| `"menu"` \| `"none"`                                                              | no       | —       | Floating panel width strategy. Default `'content'`.                                                                                                                                                                                                                                                                                                     |
| `wireTriggerAria` | `boolean`                                                                                                            | no       | —       | Whether Popover owns trigger ARIA wiring. Default `true`.                                                                                                                                                                                                                                                                                               |
| `children`        | `(opaque)`                                                                                                           | yes      | —       | Panel content. Required. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                     |
| `trigger`         | `(opaque)`                                                                                                           | no       | —       | Optional trigger snippet rendered inside a wrapper. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                          |
| `triggerRef`      | `(opaque)`                                                                                                           | no       | —       | Explicit anchor element. Wins over the snippet-resolved focusable. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                           |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
