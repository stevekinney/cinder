import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    leadingInteractive: {
      type: 'boolean',
    },
    trailingInteractive: {
      type: 'boolean',
    },
    label: {
      type: 'string',
    },
    description: {
      type: 'string',
    },
    error: {
      type: 'string',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'class',
        reason: 'unknown-shape',
      },
      {
        name: 'leading',
        reason: 'function-or-snippet',
      },
      {
        name: 'trailing',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
