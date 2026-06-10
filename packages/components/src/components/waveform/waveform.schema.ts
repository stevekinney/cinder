import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    label: {
      type: 'string',
    },
    description: {
      type: 'string',
    },
    data: {
      type: 'array',
      items: {
        type: 'number',
      },
    },
    renderMode: {
      enum: ['path', 'bars'],
    },
    height: {
      type: 'number',
    },
    loading: {
      type: 'boolean',
    },
    dataTableVisibility: {
      enum: ['screen-reader-only', 'visible', 'hidden'],
    },
    dataTableCaption: {
      type: 'string',
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['data', 'label'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
