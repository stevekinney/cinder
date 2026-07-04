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
      description: 'Total number of pages. Omit when only previous/next availability is known.',
    },
    hasPreviousPage: {
      type: 'boolean',
      description:
        'Whether a previous page is available when totalPages is unknown. Defaults to currentPage > 1.',
    },
    hasNextPage: {
      type: 'boolean',
      description:
        'Whether a next page is available when totalPages is unknown. Defaults to false.',
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
  required: ['currentPage'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
