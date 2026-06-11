import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description: 'Short label describing the metric, e.g. "Monthly Revenue".',
    },
    value: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'number',
        },
      ],
      description: 'The statistic. Strings rendered verbatim; numbers formatted via formatNumber.',
    },
    valueLocale: {
      type: 'string',
      description: 'Locale forwarded to formatNumber (defaults to en-US).',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-stat`.',
    },
  },
  additionalProperties: false,
  required: ['label', 'value'],
  metadata: {
    unsupportedProps: [
      {
        name: 'change',
        reason: 'unknown-shape',
        description: 'Optional change indicator with direction and accessible wording.',
      },
      {
        name: 'icon',
        reason: 'function-or-snippet',
        description: 'Optional leading icon snippet (decorative — wrapper is aria-hidden).',
      },
      {
        name: 'valueFormatOptions',
        reason: 'unknown-shape',
        description: 'Intl.NumberFormat options applied only when `value` is a number.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
