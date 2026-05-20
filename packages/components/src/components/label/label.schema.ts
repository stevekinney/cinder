import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    required: {
      type: 'boolean',
      description: 'When true, append a visual indicator that the field is required.',
    },
    disabled: {
      type: 'boolean',
      description: 'When true, render the label in the disabled color treatment.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'class',
        reason: 'unknown-shape',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
