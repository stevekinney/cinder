import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    orientation: {
      enum: ['horizontal', 'vertical'],
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
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
      {
        name: 'keyboardStep',
        reason: 'unknown-shape',
      },
      {
        name: 'onlayoutchange',
        reason: 'function-or-snippet',
      },
      {
        name: 'onlayoutcommit',
        reason: 'function-or-snippet',
      },
      {
        name: 'panes',
        reason: 'unknown-shape',
      },
      {
        name: 'snapThreshold',
        reason: 'unknown-shape',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
