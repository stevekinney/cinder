import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    state: {
      enum: ['active', 'trialing', 'past-due', 'canceled', 'expired', 'refunded'],
      description:
        'The billing lifecycle state to display.\nDetermines the badge tone, icon, and label automatically.',
    },
    class: {
      type: 'string',
      description: 'Extra classes forwarded to the underlying Badge.',
    },
  },
  additionalProperties: false,
  required: ['state'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
