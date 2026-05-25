import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    currentStep: {
      type: 'number',
      description:
        'Zero-based index of the active step. Steps with index < currentStep are\n"completed". Pass `steps.length` to mark every step as complete (terminal\n"done" state).',
    },
    orientation: {
      enum: ['horizontal', 'vertical'],
      description: "Layout direction. Defaults to 'horizontal'.",
    },
    label: {
      type: 'string',
      description: "Accessible name for the wrapping nav landmark. Defaults to 'Progress'.",
    },
    completedLabel: {
      type: 'string',
      description:
        "Visually-hidden text prepended to completed steps so screen readers\nannounce state + label. Defaults to 'Completed'.",
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-steps`.',
    },
  },
  additionalProperties: false,
  required: ['currentStep'],
  metadata: {
    unsupportedProps: [
      {
        name: 'steps',
        reason: 'unknown-shape',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
