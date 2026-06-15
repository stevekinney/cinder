# Modal

Generic modal shell for rich content, forms, and structured workflows. Use the more specialised components when the content fits their narrower contract.

## When to use

- Presenting rich or structured content (forms, multi-step wizards, detail views) inside a blocking overlay.
- Collecting structured input — especially when multiple fields or widgets are involved.
- Displaying content that requires user interaction before the page can continue, but where the interaction is more than a simple yes/no.

## When not to use

- Two-action confirm/cancel prompts — use [`ConfirmDialog`](../confirm-dialog/README.md) instead. It handles autofocus on the cancel button, `aria-describedby`, and the destructive-variant button automatically.
- Urgent blocking acknowledgements that must not be dismissed by Escape or backdrop click — use [`AlertDialog`](../alert-dialog/README.md) instead.
- Navigation — use a page transition or router link instead. Modals break the browser's back-button mental model.
- Persistent side content — use a [`Drawer`](../drawer/README.md) or [`Sidebar`](../sidebar/README.md) so the content stays visible while the user works.
- Displaying information that does not require a decision — use a [`Popover`](../popover/README.md) or inline content instead.

## Dialog model

Cinder provides three dialog-level components with distinct interaction contracts.

**`Modal`** is the generic shell. It handles focus capture/restore, body scroll lock, Escape dismissal, backdrop dismissal, and an optional close button. All three dismissal affordances are on by default (`dismissOnBackdropClick`, `dismissOnEscape`, `showCloseButton`). Use Modal when the content is richer than a simple prompt.

**`ConfirmDialog`** is a preset for user-initiated binary decisions. It composes Modal + two Buttons, defaults focus to the cancel button (the industry-standard guard against accidental destructive confirms), and wires `aria-describedby` automatically. Escape, backdrop click, and the close-X all fire `oncancel`. Use it for "Delete account?", "Discard changes?", and similar two-action prompts.

**`AlertDialog`** is a preset for urgent, blocking acknowledgements. It renders Modal with `role="alertdialog"`, `dismissOnBackdropClick={false}`, `dismissOnEscape={false}`, and no close button. The user must click an explicit action button to proceed. Use it for session expiry and system-level errors — cases where the _system_ surfaces a condition that must be acknowledged before continuing. For user-initiated actions (even high-impact ones), use `ConfirmDialog` instead.

## The `role` prop and `alertdialog`

Modal accepts `role="alertdialog"` directly. This is intentional: some applications need to compose their own sticky dialog outside the `AlertDialog` preset (for example, a dialog with richer body content than `AlertDialog`'s plain-text `description` prop allows).

When composing `role="alertdialog"` on Modal directly:

- Set `dismissOnBackdropClick={false}` and `dismissOnEscape={false}` — otherwise the urgent-blocking contract is broken.
- Set `showCloseButton={false}` — a close-X contradicts the "must acknowledge" intent.
- Pass `describedById` pointing at a descriptive element in the body — `aria-describedby` is required for `alertdialog`.

If the content fits the plain-text `description` constraint, prefer `AlertDialog` over composing Modal + `role="alertdialog"` manually.

## Related components

- [`ConfirmDialog`](../confirm-dialog/README.md) — pre-wired confirm/cancel variant built on Modal. Use for binary decisions.
- [`AlertDialog`](../alert-dialog/README.md) — sticky alert dialog that cannot be dismissed by Escape or backdrop click. Use for urgent acknowledgements.
- [`Drawer`](../drawer/README.md) — side-anchored overlay for supplementary content.
- [`Sheet`](../sheet/README.md) — bottom-anchored overlay for mobile-style interactions.
- [`Popover`](../popover/README.md) — non-blocking floating panel for contextual content.

## Usage

```svelte
<script lang="ts">
  import Modal from '@lostgradient/cinder/modal';
</script>

<Modal />
```

## Props

<!-- generated:props:start -->

| Prop                     | Type                          | Required | Default | Description                                                                                                                                                                                                                                                                                                         |
| ------------------------ | ----------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`                  | `string`                      | no       | —       | Additional class names merged with the component's root class.                                                                                                                                                                                                                                                      |
| `describedById`          | `string`                      | no       | —       | When set, applied as aria-describedby on the underlying <dialog>. Pass a short, plain description ID only.                                                                                                                                                                                                          |
| `dismissOnBackdropClick` | `boolean`                     | no       | —       | When true, clicking the backdrop outside the modal panel dismisses it. Default `true`.                                                                                                                                                                                                                              |
| `dismissOnEscape`        | `boolean`                     | no       | —       | When true, pressing Escape dismisses the modal. Default `true`.                                                                                                                                                                                                                                                     |
| `open`                   | `boolean`                     | yes      | —       | Controls whether the modal is open; bindable for controlled usage.                                                                                                                                                                                                                                                  |
| `role`                   | `"dialog"` \| `"alertdialog"` | no       | —       | ARIA role applied to the underlying dialog element. Default `dialog`.                                                                                                                                                                                                                                               |
| `showCloseButton`        | `boolean`                     | no       | —       | When true, renders the close button in the upper corner of the modal panel. Default `true`.                                                                                                                                                                                                                         |
| `title`                  | `string`                      | yes      | —       | Text rendered as the modal's visible heading and used as its accessible label.                                                                                                                                                                                                                                      |
| `children`               | `(opaque)`                    | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                          |
| `footer`                 | `(opaque)`                    | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                          |
| `ondismiss`              | `(opaque)`                    | no       | —       | Fired on user-initiated dismissal. Includes: Escape key (native dialog 'cancel' event), backdrop click, and the close-X button. EXCLUDES: parent-driven open = false. Callbacks are not awaited and thrown callbacks do not block close. Not expressible in JSON Schema; see the component types for the signature. |
| `triggerRef`             | `(opaque)`                    | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
