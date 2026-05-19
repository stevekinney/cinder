import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    size: {
      enum: ['sm', 'md', 'lg'],
      description: 'Spinner size.',
      default: 'md',
    },
    label: {
      type: 'string',
      description: 'Accessible loading label.',
      default: 'Loading',
    },
    class: {
      type: 'string',
      description: 'Extra classes appended to the root element.',
    },
  },
  additionalProperties: false,
} satisfies ComponentSchema;

export default schema as ComponentSchema;
