import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    granted: {
      type: 'boolean',
      description: 'Whether the consumer-authorized action or section is available.',
    },
    variant: {
      enum: ['inline', 'section'],
      description: 'Presentation mode.',
      default: 'inline',
    },
    reason: {
      type: 'string',
      description: 'Human-readable explanation shown to users and wired to assistive technology.',
    },
    requirement: {
      type: 'string',
      description:
        'Named scope, permission, or policy requirement shown in the section placeholder.',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with the denied-state wrapper or section placeholder.',
    },
  },
  additionalProperties: false,
  required: ['granted', 'reason'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        description: 'Gated content. Rendered untouched when access is granted.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
