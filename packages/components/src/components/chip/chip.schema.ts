import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    mode: {
      enum: ['display', 'toggle', 'removable'],
      description: 'Rendering and interaction mode. Default `"display"`.',
    },
    label: {
      type: 'string',
      description: 'Visible text content of the chip.',
    },
    variant: {
      enum: ['neutral', 'success', 'warning', 'danger', 'info', 'accent'],
      description: 'Color variant applied to the chip. Default `"neutral"`.',
    },
    size: {
      enum: ['sm', 'md'],
      description: 'Size of the chip. Default `"md"`.',
    },
    density: {
      const: 'toolbar',
      description:
        'When set to `"toolbar"`, opts the chip into compact toolbar sizing to align with sibling toolbar controls.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged onto the chip element.',
    },
    pressed: {
      type: 'boolean',
      description:
        'Toggle mode only. Whether the chip is currently in the pressed (selected) state. Reflected as `aria-pressed`.',
    },
    disabled: {
      type: 'boolean',
      description:
        'Toggle mode only. When true, disables the toggle button and prevents interaction.',
    },
    removeAriaLabel: {
      type: 'string',
      description:
        "Removable mode only. Accessible label for the remove button. Defaults to `Remove` followed by the chip's `label`.",
    },
  },
  additionalProperties: false,
  required: ['label'],
  metadata: {
    unsupportedProps: [
      {
        name: 'leadingIcon',
        reason: 'function-or-snippet',
      },
      {
        name: 'onpressedchange',
        reason: 'function-or-snippet',
      },
      {
        name: 'onremove',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
