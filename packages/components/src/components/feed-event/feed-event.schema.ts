import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    class: {
      type: 'string',
    },
    datetime: {
      type: 'string',
      description:
        'ISO 8601 datetime string. Rendered as `<time datetime={datetime}>` so\nassistive tech and parsers receive a machine-readable timestamp. The\nvisible label inside the `<time>` element is consumer-controlled via\nthe required `timestamp` snippet.',
    },
    variant: {
      enum: ['icon', 'minimal'],
      description: 'Icon variant: renders a circular badge on the rail with the icon inside.',
    },
  },
  additionalProperties: false,
  required: ['datetime'],
  metadata: {
    unsupportedProps: [
      {
        name: 'content',
        reason: 'function-or-snippet',
      },
      {
        name: 'icon',
        reason: 'function-or-snippet',
      },
      {
        name: 'timestamp',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
