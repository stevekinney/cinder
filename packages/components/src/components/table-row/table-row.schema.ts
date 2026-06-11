import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-table__row`.',
    },
    selected: {
      type: 'boolean',
    },
    selectionLabel: {
      type: 'string',
      description:
        'Accessible name for the disabled selection checkbox. Provide a localised\nstring to override the English default ("Selection not allowed for this\nrow"). The library cannot localise on the consumer\'s behalf, so this is\nthe seam for non-English applications or custom phrasing.',
    },
    selectionDisabled: {
      type: 'boolean',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Cell children (TableCell or TableHeaderCell).',
      },
      {
        name: 'onSelectedChange',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
