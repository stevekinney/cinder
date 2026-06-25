import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    variant: {
      enum: ['neutral', 'success', 'warning', 'danger', 'info', 'accent'],
      description: 'Visual style.',
      default: 'neutral',
    },
    size: {
      enum: ['xs', 'sm', 'md'],
      description: 'Size of the badge.',
      default: 'md',
    },
    mono: {
      type: 'boolean',
      description:
        'Render the badge label in a monospace font. Useful for version strings, error codes, or other technical labels.',
      default: false,
    },
    subscriptionState: {
      enum: ['active', 'trialing', 'past-due', 'canceled', 'expired', 'refunded'],
      description:
        'Render a standardized subscription lifecycle badge without hand-wiring tone, icon, and label.',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-badge`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        description:
          'Required badge content unless subscriptionState is provided; optional content override for the subscription preset label.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
