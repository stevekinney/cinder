import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    feature: {
      type: 'string',
      description: 'The feature being gated.',
    },
    state: {
      enum: [
        'supported',
        'unsupported',
        'permission-needed',
        'permission-denied',
        'loading',
        'unavailable',
      ],
      description: 'Current availability state.',
    },
    variant: {
      enum: ['inline', 'banner', 'callout'],
      description: 'Presentation variant.',
      default: 'inline',
    },
    primaryAction: {
      type: 'string',
      description: 'Label for the primary action button.',
    },
    fallbackAction: {
      type: 'string',
      description: 'Label for the fallback action.',
    },
    fallbackHref: {
      type: 'string',
      description: 'Href for a fallback link.',
    },
    dismissAction: {
      type: 'string',
      description: 'Label for the dismiss action.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-capability-gate`.',
    },
  },
  additionalProperties: false,
  required: ['feature', 'state'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        description: 'Custom content rendered below the status text and before the actions.',
      },
      {
        name: 'ondismiss',
        reason: 'function-or-snippet',
        description: 'Called when the gate is dismissed.',
      },
      {
        name: 'onFallbackAction',
        reason: 'function-or-snippet',
        description: 'Called when the fallback action button is activated.',
      },
      {
        name: 'onPrimaryAction',
        reason: 'function-or-snippet',
        description: 'Called when the primary action button is activated.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
