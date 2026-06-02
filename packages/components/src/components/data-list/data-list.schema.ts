import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    density: {
      enum: ['comfortable', 'condensed'],
      description:
        'List-level density inherited by StackedListItem rows that do not set their\nown `density` prop. Omit to let each row use its own default. A per-row\n`density` always overrides this list-level value.',
    },
    class: {
      type: 'string',
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
        name: 'empty',
        reason: 'function-or-snippet',
      },
      {
        name: 'items',
        reason: 'generic-type-parameter',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
