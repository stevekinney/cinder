import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    separator: {
      type: 'string',
      description: 'Custom string separator between entries.',
      default: '/',
    },
    label: {
      type: 'string',
      description: 'Accessible name for the nav landmark.',
      default: 'Breadcrumb',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-breadcrumbs`.',
    },
  },
  additionalProperties: false,
} satisfies ComponentSchema;

export default schema as ComponentSchema;
