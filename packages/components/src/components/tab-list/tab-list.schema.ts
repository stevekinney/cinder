import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description: 'Optional accessible name for the tablist. Sets `aria-label`.',
    },
    labelledBy: {
      type: 'string',
      description: 'Reference to a heading or label element that names the tablist.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-tab-list`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Tab children.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
