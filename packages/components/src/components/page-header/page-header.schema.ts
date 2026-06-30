import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Page-level heading text. Rendered as `<h1>`.',
    },
    meta: {
      type: 'string',
      description: 'Optional supporting metadata displayed beside the title.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-page-header`.',
    },
  },
  additionalProperties: false,
  required: ['title'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        description: 'Optional trailing actions (buttons, menus, controls).',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
