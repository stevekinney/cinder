import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    heading: {
      type: 'string',
      description: 'Optional heading for the entire shortcuts panel.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-keyboard-shortcuts`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        description: 'Intro content rendered above the groups.',
      },
      {
        name: 'groups',
        reason: 'unknown-shape',
        required: true,
        description: 'Groups of shortcuts to display.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
