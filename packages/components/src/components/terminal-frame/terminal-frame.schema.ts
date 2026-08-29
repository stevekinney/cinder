import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    title: {
      type: 'string',
    },
    status: {
      enum: ['connecting', 'connected', 'disconnected', 'error'],
    },
    error: {
      type: 'string',
    },
    columnWidth: {
      type: 'number',
    },
    rowHeight: {
      type: 'number',
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['title'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
      },
      {
        name: 'onDimensionsChange',
        reason: 'function-or-snippet',
      },
      {
        name: 'onReloadRequest',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
