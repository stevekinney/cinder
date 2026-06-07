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
        type: 'object',
        additionalProperties: {
          anyOf: [
            {
              type: 'string',
            },
            {
              type: 'number',
            },
            {
              type: 'null',
            },
          ],
        },
      },
    },
    xField: {
      type: 'string',
    },
    yField: {
      type: 'string',
    },
    valueField: {
      type: 'string',
    },
    colorScale: {
      enum: ['sequential', 'diverging'],
    },
    showCellLabels: {
      type: 'boolean',
    },
    height: {
      type: 'number',
    },
    loading: {
      type: 'boolean',
    },
    dataTableCaption: {
      type: 'string',
    },
    dataTableVisibility: {
      enum: ['screen-reader-only', 'visible', 'hidden'],
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['data', 'label', 'valueField', 'xField', 'yField'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
