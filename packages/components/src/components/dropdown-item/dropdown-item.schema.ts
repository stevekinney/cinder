import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    variant: {
      enum: ['default', 'danger'],
    },
    inset: {
      type: 'boolean',
    },
    closeOnSelect: {
      type: 'boolean',
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
} satisfies ComponentSchema;

export default schema as ComponentSchema;
