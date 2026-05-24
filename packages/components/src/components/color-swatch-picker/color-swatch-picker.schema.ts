import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    value: {
      type: 'string',
      description: 'Controlled selected color. When provided, the parent owns the state.',
    },
    defaultValue: {
      type: 'string',
      description: 'Initial selected color for uncontrolled use. Ignored when `value` is set.',
    },
    colors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          color: {
            type: 'string',
            description: 'CSS color string rendered as the swatch background.',
          },
          name: {
            type: 'string',
            description:
              'Optional human label. When omitted, the `color` string is the accessible name.',
          },
          disabled: {
            type: 'boolean',
            description:
              'Disables this individual swatch. Skipped during keyboard navigation; not selectable.',
          },
        },
        required: ['color'],
        additionalProperties: false,
      },
      description: 'Palette to render.',
    },
    shape: {
      enum: ['circle', 'square'],
      description: "Visual shape of each swatch. Default `'circle'`.",
    },
    size: {
      enum: ['xs', 'sm', 'md', 'lg', 'xl'],
      description: "Swatch dimension token. Default `'md'`.",
    },
    layout: {
      enum: ['grid', 'stack'],
      description:
        "Layout direction. Default `'grid'`.\n\nNote: grid layout uses one-dimensional DOM-order navigation for both\nArrowLeft/Right and ArrowUp/Down. True column-aware navigation is not\nimplemented in v1 — see a11y memo.",
    },
    disabled: {
      type: 'boolean',
      description: 'Disables the entire listbox. Keyboard activation and clicks are ignored.',
    },
    label: {
      type: 'string',
      description:
        'Accessible name for the listbox. Required — `role="listbox"` needs a label\nso screen readers can announce the control\'s purpose.',
    },
    class: {
      type: 'string',
      description: 'Additional classes merged into the listbox `<ul>`.',
    },
  },
  additionalProperties: false,
  required: ['colors', 'label'],
  metadata: {
    unsupportedProps: [
      {
        name: 'indicator',
        reason: 'function-or-snippet',
      },
      {
        name: 'onchange',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
