# ClickAwayListener

Headless utility that calls a function when the user clicks or taps outside a subtree.

## Usage

```svelte
<script lang="ts">
  import Button from '@lostgradient/cinder/button';
  import ClickAwayListener from '@lostgradient/cinder/click-away-listener';

  let open = $state(false);
</script>

<Button onclick={() => (open = true)}>Open inline editor</Button>

{#if open}
  <ClickAwayListener
    onClickAway={() => (open = false)}
    style="
      display: inline-flex;
      flex-direction: column;
      gap: var(--cinder-space-3);
      margin-block-start: var(--cinder-space-4);
      padding: var(--cinder-space-4);
      border: 1px solid var(--cinder-border);
      border-radius: var(--cinder-radius-lg);
      background: var(--cinder-surface-raised);
    "
  >
    <p style="margin: 0;">Click outside this box to dismiss it.</p>
    <Button variant="secondary" onclick={() => (open = false)}>Close</Button>
  </ClickAwayListener>
{/if}
```

## Guidance

### Use When

- Building a custom inline-edit field, custom dropdown, or any overlay that should close on outside interaction.

### Avoid When

- Using Popover, Dropdown, or Modal — those handle click-away internally.

## Props

<!-- generated:props:start -->

| Prop          | Type       | Required | Default | Description                                                                                                                                                                                                                                                           |
| ------------- | ---------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`   | no       | —       | Additional class names merged with the root element.                                                                                                                                                                                                                  |
| `enabled`     | `boolean`  | no       | —       | When false the document listener is detached and `onClickAway` is never called. Defaults to `true`.                                                                                                                                                                   |
| `children`    | `(opaque)` | yes      | —       | Content rendered inside the root element. Required. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                        |
| `onClickAway` | `(opaque)` | yes      | —       | Called with the triggering PointerEvent (or MouseEvent/TouchEvent on browsers that do not support the Pointer Events API) when the user presses a pointer device outside the root element. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
