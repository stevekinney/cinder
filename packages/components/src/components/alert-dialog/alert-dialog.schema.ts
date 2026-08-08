import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    cancelLabel: {
      type: 'string',
      description:
        "Label for the cancel button. When omitted, NO cancel button is rendered —\nan alert dialog's default shape is a single acknowledgement.",
    },
    open: {
      type: 'boolean',
      description: 'Controls whether the alert dialog is open; bindable for controlled usage.',
    },
    title: {
      type: 'string',
      description: "Text rendered as the dialog's visible heading and accessible label.",
    },
    description: {
      type: 'string',
      description:
        'Explanatory paragraph displayed in the dialog body and wired to the dialog via aria-describedby.',
    },
    acknowledgeLabel: {
      type: 'string',
      description: 'Label for the primary acknowledgement button. Default `OK`.',
    },
    destructive: {
      type: 'boolean',
      description:
        'When true, styles the acknowledgement button as a danger action and, when a cancel button is rendered, gives it initial focus instead of the acknowledgement button. Default `false`.',
    },
    class: {
      type: 'string',
      description: "Additional class names merged with the component's root class.",
    },
  },
  additionalProperties: false,
  required: ['description', 'open', 'title'],
  metadata: {
    unsupportedProps: [
      {
        name: 'onAcknowledge',
        reason: 'function-or-snippet',
        required: true,
      },
      {
        name: 'onCancel',
        reason: 'function-or-snippet',
        description:
          "Called when the user cancels (cancel button, Escape, or backdrop per the dialog's policy).",
      },
      {
        name: 'triggerRef',
        reason: 'unknown-shape',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
