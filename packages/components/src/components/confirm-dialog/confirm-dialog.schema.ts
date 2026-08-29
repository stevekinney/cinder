import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    cancelLabel: {
      type: 'string',
      description: 'Label for the cancel button, which ALWAYS renders.',
      default: 'Cancel',
    },
    open: {
      type: 'boolean',
      description: 'Controls visibility. Bindable.',
    },
    title: {
      type: 'string',
      description: 'Modal title; passed through to <Modal>.',
    },
    description: {
      type: 'string',
      description:
        'Optional body description — short, plain text only. Rendered as a single <p> and wired\nto aria-describedby. For rich content (markup, lists, multiple paragraphs), compose\n<Modal> + <Button> directly — screen readers announce aria-describedby targets as one\ncontinuous run.',
    },
    confirmLabel: {
      type: 'string',
      description:
        'Confirm button label. Required — no default. Name the action being confirmed:\n- Destructive: "Delete", "Discard changes", "Remove from organization".\n- Non-destructive: "Save", "Continue", "Publish".\nNever use "OK" or "Confirm" in production — they don\'t describe the action.',
    },
    destructive: {
      type: 'boolean',
      description:
        'When true, the confirm button uses variant="danger". The cancel button still\nreceives default focus regardless — color is never the sole destructive signal.',
    },
    typeToConfirm: {
      type: 'string',
      description:
        'When set, renders a labelled text input and disables the confirm button until the\ntrimmed input matches this value case-insensitively.',
    },
    typeToConfirmLabel: {
      type: 'string',
      description:
        'Visible label for the typed-confirmation input. Defaults to `Type "<value>" to confirm`.',
    },
    class: {
      type: 'string',
      description:
        'Optional extra class on the underlying <Modal>. Destructured as `class: className` per repo convention.',
    },
  },
  additionalProperties: false,
  required: ['confirmLabel', 'open', 'title'],
  metadata: {
    unsupportedProps: [
      {
        name: 'onCancel',
        reason: 'function-or-snippet',
        description:
          "Called when the user cancels (cancel button, Escape, or backdrop per the dialog's policy).",
      },
      {
        name: 'onConfirm',
        reason: 'function-or-snippet',
        required: true,
        description:
          'Fired when the user activates the confirm button. Required. Component closes itself after.',
      },
      {
        name: 'onExitComplete',
        reason: 'function-or-snippet',
        description: "Fired once the underlying modal's exit transition has completed.",
      },
      {
        name: 'triggerRef',
        reason: 'unknown-shape',
        description: 'Forwarded to <Modal>; focus is restored here on close.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
