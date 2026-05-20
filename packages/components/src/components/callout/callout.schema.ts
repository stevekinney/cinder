import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    variant: {
      enum: ['info', 'success', 'warning', 'danger'],
      description: "Visual + semantic variant. Default `'info'`.",
    },
    class: {
      type: 'string',
      description:
        'Extra classes appended to the root element. Pass via the explicit\n`class` prop — it is excluded from rest-prop spread, so writing\n`class="x"` inside spread attributes will not reach the root.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
      {
        name: 'icon',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
