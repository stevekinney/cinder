import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    caption: {
      type: 'string',
      description: 'Visual caption rendered as a `<caption>` element above the table.',
    },
    stickyHeader: {
      type: 'boolean',
      description: 'When true, the header sticks to the top of the scrolling container.',
    },
    density: {
      enum: ['comfortable', 'condensed', 'spacious'],
      description:
        "Vertical padding density for header and body cells.\nDefaults to `'comfortable'`.",
    },
    scrollable: {
      type: 'boolean',
      description:
        'When true, wraps the table in a `.cinder-table-scroll` container that\nenables horizontal overflow scrolling on small viewports.',
    },
    virtualized: {
      type: 'boolean',
      description:
        'When true, renders only the visible `<tbody>` row window plus spacer rows.\nRequires a fixed row height. This is intended for large, append-only tables\nsuch as live logs or event streams.',
    },
    rowHeight: {
      type: 'number',
      description:
        'Fixed body row height in pixels for virtualized mode.\nThis must match the actual rendered body row height, including density\npadding and any wrapping introduced by the table content.\nDefaults to 44.',
    },
    overscan: {
      type: 'number',
      description:
        'Extra body rows rendered before and after the visible virtualized window.\nDefaults to 5.',
    },
    height: {
      type: 'string',
      description:
        'CSS block-size for the virtualized native scroll container.\nDefaults to `"24rem"` when `virtualized` is true.',
    },
    stickToBottom: {
      type: 'boolean',
      description:
        'When true in virtualized mode, appending rows while scrolled to the bottom\nkeeps the newest row pinned in view. Appending while scrolled up does not\nchange the viewport.',
    },
    class: {
      type: 'string',
      description:
        'Additional class names merged onto DataTable\'s root wrapper element (the\n`<div class="cinder-data-table">` that contains the table). To style the\n`<table>` itself, target `.cinder-data-table table` from this class.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'columns',
        reason: 'unknown-shape',
        required: true,
        description: 'Column descriptors defining the headers and cell rendering for each column.',
      },
      {
        name: 'rows',
        reason: 'generic-type-parameter',
        required: true,
        description: 'Row data. Each entry is read via `column.key` for each column.',
      },
      {
        name: 'sort',
        reason: 'unknown-shape',
        description:
          'Bound sort state. When the user activates a sortable header cell, this prop\nis updated with the new `{ column, direction }`. The consumer is responsible\nfor reordering `rows` in response — DataTable does not sort internally.\n\nPass `undefined` initially when no column is sorted; the component will never\nwrite back `undefined` itself (sort always toggles to a column).',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
