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
    },
    yAxis: {
      type: 'object',
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
    series: {
      type: 'array',
      items: {
        type: 'object',
      },
    },
  },
  additionalProperties: false,
  required: ['label', 'series'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
