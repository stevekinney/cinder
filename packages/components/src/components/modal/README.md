# Modal

Blocking overlay dialog that demands user attention before returning to the page.

## When to use

- Confirming or completing a focused task that requires user input before proceeding (e.g. editing a record, selecting a file).
- Displaying a warning or prompt that must be acknowledged before the user can continue.
- Presenting a contained workflow (such as a multi-step form) that should not navigate away from the current page.

## When not to use

- Navigation — use a page transition or router link instead. Modals break the browser's back-button mental model.
- Persistent side content — use a [`Drawer`](../drawer/README.md) or [`Sidebar`](../sidebar/README.md) so the content stays visible while the user works.
- Simple confirm/cancel prompts — use [`ConfirmDialog`](../confirm-dialog/README.md) for the pre-wired two-action pattern.
- Displaying information that does not require a decision — use a [`Popover`](../popover/README.md) or inline content instead.

## Related components

- [`ConfirmDialog`](../confirm-dialog/README.md) — pre-wired confirm/cancel variant built on Modal.
- [`Drawer`](../drawer/README.md) — side-anchored overlay for supplementary content.
- [`Sheet`](../sheet/README.md) — bottom-anchored overlay for mobile-style interactions.
- [`Popover`](../popover/README.md) — non-blocking floating panel for contextual content.

## Usage

```svelte
<script lang="ts">
  import Modal from 'cinder/modal';
</script>

<Modal />
```

## Props

<!-- generated:props:start -->

| Prop                     | Type                          | Required | Default | Description                                                                                                                |
| ------------------------ | ----------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`                  | `string`                      | no       | —       |                                                                                                                            |
| `describedById`          | `string`                      | no       | —       | When set, applied as aria-describedby on the underlying <dialog>. Pass a short, plain description ID only.                 |
| `dismissOnBackdropClick` | `boolean`                     | no       | —       |                                                                                                                            |
| `dismissOnEscape`        | `boolean`                     | no       | —       |                                                                                                                            |
| `open`                   | `boolean`                     | yes      | —       |                                                                                                                            |
| `role`                   | `"dialog"` \| `"alertdialog"` | no       | —       |                                                                                                                            |
| `showCloseButton`        | `boolean`                     | no       | —       |                                                                                                                            |
| `title`                  | `string`                      | yes      | —       |                                                                                                                            |
| `children`               | `(opaque)`                    | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `footer`                 | `(opaque)`                    | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `ondismiss`              | `(opaque)`                    | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `triggerRef`             | `(opaque)`                    | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
