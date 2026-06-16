import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    value: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'IDs currently assigned to the right-side selected list. Supports `bind:value`.',
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
  metadata: {
    unsupportedProps: [
      {
        name: 'items',
        reason: 'unknown-shape',
        required: true,
        description: 'Full item pool. The component never mutates this array.',
      },
      {
        name: 'onChange',
        reason: 'function-or-snippet',
        description: 'Called with the next right-side value after a transfer.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
