import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    value: {
      type: 'string',
      description: 'Submitted value; surfaced through the registration record.',
    },
    disabled: {
      type: 'boolean',
      description: 'When true, the item is skipped by arrow keys and cannot be activated.',
    },
    description: {
      type: 'string',
      description: 'Optional secondary text shown below the main label.',
    },
    class: {
      type: 'string',
      description: 'Class merged with `.cinder-command-item`.',
    },
    selectionMode: {
      enum: ['item', 'parent'],
      description: 'The item owns activation. This is the default CommandPalette mode.',
    },
  },
  additionalProperties: false,
  required: ['value'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
      {
        name: 'leading',
        reason: 'function-or-snippet',
      },
      {
        name: 'onselect',
        reason: 'function-or-snippet',
      },
      {
        name: 'trailing',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
