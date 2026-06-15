import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
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
    cancelLabel: {
      type: 'string',
      description:
        'Label for the optional cancel button. When omitted, no cancel button is rendered.',
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
        name: 'onacknowledge',
        reason: 'function-or-snippet',
        required: true,
      },
      {
        name: 'oncancel',
        reason: 'function-or-snippet',
      },
      {
        name: 'triggerRef',
        reason: 'unknown-shape',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
