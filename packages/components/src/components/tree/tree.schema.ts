import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    selectionMode: {
      enum: ['none', 'single', 'multiple'],
      description: "Selection model. Default: 'none'.",
    },
    selectedIds: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'Currently selected node ids. Bindable.',
    },
    expandedIds: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'Currently expanded branch ids. Bindable.',
    },
    'aria-label': {
      type: 'string',
      description:
        'Accessible label for the tree. One of aria-label or aria-labelledby is required.',
    },
    'aria-labelledby': {
      type: 'string',
    },
    disableTypeahead: {
      type: 'boolean',
      description: 'Disable typeahead. Default: false.',
    },
    class: {
      type: 'string',
      description: 'Additional CSS class merged with `.cinder-tree`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
