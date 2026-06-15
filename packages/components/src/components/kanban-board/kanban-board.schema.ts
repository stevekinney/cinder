import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description: "Accessible label applied to the board's `<section>` root via `aria-label`.",
    },
    collapsible: {
      type: 'boolean',
      description:
        'When true, each column renders a collapse/expand button that toggles its card list.',
    },
    reorderColumns: {
      type: 'boolean',
      description:
        'When true (default), columns can be reordered by dragging or keyboard. Set to false to make column order fixed.',
    },
    class: {
      type: 'string',
      description: 'Additional class merged onto the `.cinder-kanban-board` root element.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'card',
        reason: 'function-or-snippet',
        required: true,
      },
      {
        name: 'columnActions',
        reason: 'function-or-snippet',
      },
      {
        name: 'columnHeader',
        reason: 'function-or-snippet',
      },
      {
        name: 'columns',
        reason: 'unknown-shape',
        required: true,
      },
      {
        name: 'emptyColumn',
        reason: 'function-or-snippet',
      },
      {
        name: 'getCardKey',
        reason: 'function-or-snippet',
        required: true,
      },
      {
        name: 'getCardLabel',
        reason: 'function-or-snippet',
        required: true,
      },
      {
        name: 'onchange',
        reason: 'function-or-snippet',
        required: true,
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
