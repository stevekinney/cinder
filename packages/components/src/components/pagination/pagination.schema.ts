import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    currentPage: {
      type: 'number',
      description: 'Current page number (1-indexed). Bindable.',
    },
    totalPages: {
      type: 'number',
      description: 'Total number of pages.',
    },
    totalCount: {
      type: 'number',
      description: 'Optional total record count; formatted with formatNumber when provided.',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-pagination`.',
    },
  },
  additionalProperties: false,
  required: ['currentPage', 'totalPages'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
