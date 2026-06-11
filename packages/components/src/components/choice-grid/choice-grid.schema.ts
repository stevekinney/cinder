import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    value: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
      description:
        'The currently selected value (single-select mode). Bindable.\nPass `null` or omit to start with no selection.',
    },
    values: {
      type: 'array',
      items: {
        type: 'string',
      },
      description:
        'Currently selected values (multi-select mode). Bindable. Only used when\n`multiple` is `true` — set `multiple` explicitly to switch modes; binding\n`values` alone does NOT enable multi-select.',
    },
    multiple: {
      type: 'boolean',
      description:
        'When true the grid allows multiple simultaneous selections and reads/writes\n`values` instead of `value`. The ARIA role switches to `group` (items become\n`checkbox`); single-select uses `radiogroup` (items become `radio`).',
    },
    columns: {
      enum: ['responsive', 1, 2, 3, 4],
      description:
        "Column layout.\n- `'responsive'` — `auto-fill` at a minimum cell width (default).\n- `1 | 2 | 3 | 4` — fixed number of columns.",
    },
    minColumnWidth: {
      type: 'string',
      description:
        'Minimum cell width for `columns="responsive"`. Accepts any CSS\n`<length>` (e.g. `"12rem"`, `"200px"`). Default: `"10rem"`.',
    },
    ariaLabel: {
      type: 'string',
      description: 'Accessible label for the grid (required unless `ariaLabelledby` is set).',
    },
    ariaLabelledby: {
      type: 'string',
      description: 'Id of an external element that labels this grid.',
    },
    disabled: {
      type: 'boolean',
      description: 'Disables all items in the grid.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: '`ChoiceGridItem` children.',
      },
      {
        name: 'class',
        reason: 'unknown-shape',
        description: 'Additional class names merged with `.cinder-choice-grid`.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
