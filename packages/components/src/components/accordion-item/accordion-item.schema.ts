import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: "Unique identifier matched against Accordion's expandedIds.",
    },
    title: {
      type: 'string',
      description: 'Visible header label for the item.',
    },
    disabled: {
      type: 'boolean',
      description: 'When true, the item cannot be toggled.',
      default: false,
    },
    class: {
      type: 'string',
      description: 'Additional CSS class merged with `.cinder-accordion-item`.',
    },
    style: {
      type: 'string',
      description: 'Inline style string applied to the `.cinder-accordion-item` root.',
    },
  },
  additionalProperties: false,
  required: ['id', 'title'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Panel content rendered when the item is expanded.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
