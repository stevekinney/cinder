import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    sort: {
      type: 'object',
      description:
        'Bound sort state. When the user activates a sortable header, this prop\nis updated to reflect the new column / direction.\n\nPass `undefined` initially when no column is sorted; the component will\nnever write back `undefined` itself (sort always toggles to a column).',
    },
    caption: {
      type: 'string',
      description: 'Visual caption rendered as a `<caption>` element.',
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
    selectable: {
      type: 'boolean',
      description:
        "Enables the leading selection column on the entire table. When true:\n- The single `TableRow` inside `TableHeader` renders a leading `<th>`\n  with a select-all checkbox sourced from the header's props.\n- Every `TableRow` inside `TableBody` renders a leading selection cell.\nSelection is strictly controlled — the consumer owns all selection state.",
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-table`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
