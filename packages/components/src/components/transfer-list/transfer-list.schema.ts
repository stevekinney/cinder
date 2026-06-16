import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique stable item identifier stored in `value`.',
          },
          label: {
            type: 'string',
            description: 'Visible option label.',
          },
          disabled: {
            type: 'boolean',
            description:
              'Prevents selecting or transferring the item from the available list. Already-selected disabled items remain removable.',
          },
        },
        additionalProperties: false,
        required: ['id', 'label'],
      },
      description:
        'Full item pool. Item IDs must be unique; duplicate IDs after the first are ignored. The component never mutates this array.',
    },
    value: {
      type: 'array',
      items: {
        type: 'string',
      },
      description:
        'Unique IDs currently assigned to the right-side selected list. Supports `bind:value`. Unknown IDs are ignored and dropped on the next transfer.',
    },
    leftLabel: {
      type: 'string',
      description: 'Accessible and visible label for the left list.',
      default: 'Available',
    },
    rightLabel: {
      type: 'string',
      description: 'Accessible and visible label for the right list.',
      default: 'Selected',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-transfer-list`.',
    },
  },
  additionalProperties: false,
  required: ['items'],
  metadata: {
    unsupportedProps: [
      {
        name: 'onChange',
        reason: 'function-or-snippet',
        description: 'Called with the next right-side value after a transfer.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
