import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    variant: {
      enum: ['info', 'success', 'warning', 'danger', 'error'],
      description:
        'Visual severity variant. `danger` is the canonical failure-severity spelling, consistent with banner and callout.\n`error` remains accepted as a deprecated alias.',
      default: 'info',
    },
    dismissible: {
      type: 'boolean',
      description: 'Allow the alert to be dismissed.',
      default: false,
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-alert`.',
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
        name: 'icon',
        reason: 'function-or-snippet',
      },
      {
        name: 'ondismiss',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
