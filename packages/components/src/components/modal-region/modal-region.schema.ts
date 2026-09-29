import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {},
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        description: 'Descendant application surface that opens modals through `useModal()`.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
