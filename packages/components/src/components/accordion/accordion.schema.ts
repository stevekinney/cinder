import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    multiple: {
      type: 'boolean',
      description: 'When true, multiple items may be expanded simultaneously.',
      default: false,
    },
    class: {
      type: 'string',
      description: 'Additional CSS class merged with `.cinder-accordion`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'AccordionItem children.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
