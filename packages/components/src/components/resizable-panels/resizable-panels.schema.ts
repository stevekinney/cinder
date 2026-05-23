import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    panes: {
      type: 'array',
      items: {
        type: 'object',
      },
    },
    orientation: {
      enum: ['horizontal', 'vertical'],
    },
    keyboardStep: {
      type: 'object',
    },
    snapThreshold: {
      type: 'object',
    },
    collapseOnDoubleClick: {
      type: 'boolean',
    },
    collapseTarget: {
      enum: ['leading', 'trailing', 'nearest-collapsible'],
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['panes'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
      {
        name: 'onlayoutchange',
        reason: 'function-or-snippet',
      },
      {
        name: 'onlayoutcommit',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
