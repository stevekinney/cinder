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
    height: {
      type: 'number',
    },
    xAxis: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
        },
        tickCount: {
          type: 'number',
        },
      },
      additionalProperties: false,
    },
    yAxis: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
        },
        tickCount: {
          type: 'number',
        },
      },
      additionalProperties: false,
    },
    legendPosition: {
      enum: ['top', 'bottom', 'none'],
    },
    hiddenSeriesIds: {
      type: 'array',
      items: {
        type: 'string',
      },
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
    maximumInteractivePoints: {
      type: 'number',
    },
    class: {
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
      description:
        'JSON-safe data rows. Schema cannot express dynamic categoryKey/valueKey relationships; runtime validation narrows value-key fields to number, null, or undefined.',
    },
    categoryKey: {
      type: 'string',
      description:
        'Category field name. Runtime validation requires every row to contain a string, number, or Date category.',
    },
    series: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
          },
          label: {
            type: 'string',
          },
          valueKey: {
            type: 'string',
          },
          color: {
            type: 'string',
          },
        },
        additionalProperties: false,
        required: ['id', 'label', 'valueKey'],
      },
      description:
        'Series value keys. Schema cannot prove every valueKey exists on every row; runtime validation enforces it.',
    },
    orientation: {
      enum: ['vertical', 'horizontal'],
    },
    mode: {
      enum: ['grouped', 'stacked'],
    },
  },
  additionalProperties: false,
  required: ['categoryKey', 'data', 'label', 'series'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
