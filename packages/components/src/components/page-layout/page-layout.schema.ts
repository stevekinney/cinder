import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    class: {
      type: 'string',
      description: 'Additional class names merged onto the root element.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'actions',
        reason: 'function-or-snippet',
      },
      {
        name: 'avatar',
        reason: 'function-or-snippet',
      },
      {
        name: 'breadcrumbs',
        reason: 'function-or-snippet',
      },
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
      {
        name: 'meta',
        reason: 'function-or-snippet',
      },
      {
        name: 'title',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
