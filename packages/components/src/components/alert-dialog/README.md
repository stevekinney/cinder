# AlertDialog

Sticky blocking acknowledgement dialog that cannot be dismissed by Escape or backdrop click. The user must click an explicit action button to proceed.

## Dialog model

AlertDialog is one of three dialog-level components:

- **`Modal`** — generic shell for rich content and forms.
- **`ConfirmDialog`** — preset for user-initiated binary decisions; Escape is a safe exit; cancel is the default focus.
- **`AlertDialog`** — this component. Preset for system-initiated or out-of-band urgency. No Escape exit. No backdrop dismiss. No close button. Acknowledgement is mandatory.

The key distinction between AlertDialog and ConfirmDialog is _who initiates_ the interruption and _whether dismissal without acting is safe_:

- ConfirmDialog is for user-initiated actions that need a safety gate. Pressing Escape means "never mind" — a safe, expected exit. This includes high-impact destructive actions the user initiated, even ones that affect other people.
- AlertDialog is for conditions the _system_ surfaces that require the user to acknowledge before continuing. Pressing Escape would bypass acknowledgement, which is unsafe because the session state has already changed and proceeding without reading the message is incorrect.

## When to use

- Session expiry, authentication loss, or network disconnection that requires the user to re-authenticate before continuing.
- System-level errors or process failures where the user must acknowledge the condition before taking any other action.
- Any situation where the dialog is triggered by a system event — not a user click — and dismissal by Escape or backdrop click would be incorrect because the user _must_ read and respond.

## When not to use

- User-initiated destructive actions (including high-impact ones like "Delete workspace" or "Remove all collaborators") — use [`ConfirmDialog`](../confirm-dialog/README.md). Even when the action is irreversible or affects other people, Escape is a valid "never mind" because the _user_ chose to open the dialog. ConfirmDialog's cancel-button autofocus is the right affordance.
- Rich body content (markup, lists, multiple paragraphs) — `description` is a plain-text string. For rich body, compose [`Modal`](../modal/README.md) with `role="alertdialog"` directly (see Modal's `role` prop documentation for the required companion props).
- Non-blocking notifications — use a toast or inline alert that does not interrupt the flow.

`cancelLabel` creates an explicit _alternative_ action button (e.g. "Stay signed in" alongside "Sign out"). It is not an implicit dismiss path — there is no Escape, no backdrop click, no close-X.

## Usage

```svelte
<script lang="ts">
  import AlertDialog from '@lostgradient/cinder/alert-dialog';
</script>

<AlertDialog />
```

## Props

<!-- generated:props:start -->

| Prop               | Type       | Required | Default | Description                                                                                                                                                                           |
| ------------------ | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `acknowledgeLabel` | `string`   | no       | —       | Label for the primary acknowledgement button. Default `OK`.                                                                                                                           |
| `cancelLabel`      | `string`   | no       | —       | Label for the optional cancel button. When omitted, no cancel button is rendered.                                                                                                     |
| `class`            | `string`   | no       | —       | Additional class names merged with the component's root class.                                                                                                                        |
| `description`      | `string`   | yes      | —       | Explanatory paragraph displayed in the dialog body and wired to the dialog via aria-describedby.                                                                                      |
| `destructive`      | `boolean`  | no       | —       | When true, styles the acknowledgement button as a danger action and, when a cancel button is rendered, gives it initial focus instead of the acknowledgement button. Default `false`. |
| `open`             | `boolean`  | yes      | —       | Controls whether the alert dialog is open; bindable for controlled usage.                                                                                                             |
| `title`            | `string`   | yes      | —       | Text rendered as the dialog's visible heading and accessible label.                                                                                                                   |
| `onacknowledge`    | `(opaque)` | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                            |
| `oncancel`         | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                            |
| `triggerRef`       | `(opaque)` | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                                                               |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
