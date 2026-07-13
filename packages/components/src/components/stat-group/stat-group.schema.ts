import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description:
        'Optional accessible label for the whole stat set. When provided, the\ncontainer becomes `role="group"` and uses this value as its accessible name.',
    },
    columns: {
      enum: [1, 2, 3, 4, 'auto'],
      description: "Grid column count. `'auto'` uses auto-fit with minmax for responsive layout.",
      default: "'auto'",
    },
    variant: {
      enum: ['default', 'cards', 'shared-borders'],
      description:
        "Visual variant; surfaced as `data-cinder-variant` for CSS styling.\n- `'default'` — plain grid, no borders or backgrounds.\n- `'cards'` — each stat gets a card-style border and shadow.\n- `'shared-borders'` — single outer border with 1px gap dividers between stats.",
      default: "'default'",
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-stat-group`.',
    },
    style: {
      type: 'string',
      description: 'Inline style string applied to the `.cinder-stat-group` root.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Stat children, typically one or more `<Stat>` components.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
