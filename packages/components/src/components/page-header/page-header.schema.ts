import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description:
        'Page-level heading text rendered inside the configured heading level; the runtime API also accepts a template-only snippet.',
    },
    headingLevel: {
      enum: [1, 2, 3, 4, 5, 6],
      description: 'Heading level for the title element. Default 1.',
      default: 1,
    },
    description: {
      type: 'string',
      description:
        'Optional supporting text rendered below the title; the runtime API also accepts a template-only snippet.',
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
