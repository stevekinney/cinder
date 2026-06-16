import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    density: {
      enum: ['compact', 'comfortable', 'spacious'],
      description: "Controls body row padding density. Defaults to `'comfortable'`.",
    },
    stickyHeader: {
      type: 'boolean',
      description:
        'Keeps the column header row pinned to the top edge while scrolling. Defaults to `true`.',
    },
    columnOrder: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'Applies a supplied column order.',
    },
    columnSizing: {
      type: 'object',
      additionalProperties: {
        type: 'number',
      },
      description: 'Overrides resolved column widths by column key.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged onto the root grid.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'columnPinning',
        reason: 'unknown-shape',
        description: 'Pins supplied column keys to the left or right edge.',
      },
      {
        name: 'columns',
        reason: 'unknown-shape',
        required: true,
      },
      {
        name: 'getRowAriaLabel',
        reason: 'function-or-snippet',
        description: 'Optional accessible row label for screen-reader row summaries.',
      },
      {
        name: 'getRowId',
        reason: 'function-or-snippet',
        required: true,
        description: 'Stable row identity used for ARIA ids and row-scoped state.',
      },
      {
        name: 'rowClass',
        reason: 'function-or-snippet',
        description: 'Additional class names for body rows.',
      },
      {
        name: 'rows',
        reason: 'generic-type-parameter',
        required: true,
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
