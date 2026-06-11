import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    label: {
      type: 'string',
    },
    description: {
      type: 'string',
    },
    bins: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            description: "Frequency label, e.g. '440 Hz' or '1 kHz'.",
          },
          value: {
            type: 'number',
            description: 'Magnitude or power for this bin. Non-negative.',
          },
        },
        additionalProperties: false,
        required: ['label', 'value'],
      },
    },
    height: {
      type: 'number',
    },
    loading: {
      type: 'boolean',
    },
    dataTableVisibility: {
      enum: ['screen-reader-only', 'visible', 'hidden'],
    },
    dataTableCaption: {
      type: 'string',
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['bins', 'label'],
  metadata: {
    unsupportedProps: [
      {
        name: 'empty',
        reason: 'function-or-snippet',
        description: 'Snippet rendered when there are no bins.',
      },
      {
        name: 'loadingContent',
        reason: 'function-or-snippet',
        description: 'Snippet rendered while loading.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
