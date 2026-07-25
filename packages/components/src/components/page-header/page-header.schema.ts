import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Page-level heading text rendered inside `<h1>`.',
    },
    description: {
      type: 'string',
      description: 'Optional supporting text rendered below the title.',
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
        name: 'actions',
        reason: 'function-or-snippet',
        description: 'Optional trailing actions (buttons, menus, controls).',
      },
      {
        name: 'breadcrumbs',
        reason: 'function-or-snippet',
        description: 'Optional breadcrumb navigation rendered above the heading row.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
