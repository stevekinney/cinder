import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-page-header`.',
    },
  },
  additionalProperties: false,
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
      {
        name: 'description',
        reason: 'function-or-snippet',
        description:
          'Optional supporting content rendered below the title; snippets must emit phrasing content.',
      },
      {
        name: 'title',
        reason: 'function-or-snippet',
        required: true,
        description:
          'Page-level heading content. Rendered inside `<h1>`; snippets must emit phrasing content.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
