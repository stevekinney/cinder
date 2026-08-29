import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    label: {
      type: 'string',
    },
    valueLabels: {
      type: 'boolean',
    },
    centerLabel: {
      type: 'string',
    },
    scrollable: {
      type: 'boolean',
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['label'],
  metadata: {
    unsupportedProps: [
      {
        name: 'data',
        reason: 'unknown-shape',
        required: true,
      },
      {
        name: 'onSeriesClick',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
