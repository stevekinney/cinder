import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    open: {
      type: 'boolean',
    },
    title: {
      type: 'string',
    },
    class: {
      type: 'string',
    },
    triggerRef: {
      anyOf: [
        {
          type: 'object',
        },
        {
          type: 'null',
        },
      ],
    },
    describedById: {
      type: 'string',
      description:
        'When set, applied as aria-describedby on the underlying <dialog>. Pass a short, plain description ID only.',
    },
  },
  additionalProperties: false,
  required: ['open', 'title'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
      {
        name: 'footer',
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
