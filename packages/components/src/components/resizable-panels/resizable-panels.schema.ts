import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    orientation: {
      enum: ['horizontal', 'vertical'],
      description:
        "Direction the panes are arranged. `'horizontal'` (default) places them side by side; `'vertical'` stacks them.",
    },
    collapseOnDoubleClick: {
      type: 'boolean',
      description:
        'When true, double-clicking a separator collapses or expands the adjacent collapsible pane. Default `false`.',
    },
    collapseTarget: {
      enum: ['leading', 'trailing', 'nearest-collapsible'],
      description:
        "Which pane to collapse when double-clicking a separator: `'leading'`, `'trailing'`, or `'nearest-collapsible'` (default).",
    },
    class: {
      type: 'string',
      description: 'Additional class merged onto the `.cinder-resizable-panels` root element.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
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
        required: true,
      },
      {
        name: 'snapThreshold',
        reason: 'unknown-shape',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
