import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      description:
        'When false the document listener is detached and `onClickAway` is never\ncalled. Defaults to `true`.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with the root element.',
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
        name: 'onClickAway',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
