import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Unique identifier for the control.',
    },
    label: {
      type: 'string',
      description: 'Accessible label for the group.',
    },
    hideLabel: {
      type: 'boolean',
      description: 'Visually hide the label while keeping it available to assistive technology.',
    },
    disabled: {
      type: 'boolean',
      description: 'Disable the whole control.',
    },
    size: {
      enum: ['sm', 'md', 'lg'],
      description: 'Visual size of the control.',
    },
    density: {
      const: 'toolbar',
      description:
        'Opt the control into a shared toolbar height (via\n`--cinder-control-height-sm`) so it lines up cleanly with sibling\n`Button` (size="sm"), `Chip` (density="toolbar"), and other toolbar\nelements. Default rendering is unchanged.',
    },
    orientation: {
      enum: ['horizontal', 'vertical'],
      description: 'Layout orientation.',
    },
    detached: {
      type: 'boolean',
      description: 'Render segments as detached individual buttons instead of a unified strip.',
    },
    fullWidth: {
      type: 'boolean',
      description: 'Stretch the control to fill available width.',
    },
    variant: {
      enum: ['radiogroup', 'tablist'],
      description: 'ARIA interaction pattern. Use `tablist` when options switch visible panels.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-segmented-control`.',
    },
    selectionMode: {
      enum: ['single', 'multiple'],
    },
    disallowEmptySelection: {
      type: 'boolean',
      description:
        'When true (default), clicking the already-selected option is a no-op.\nWhen false, clicking the selected option clears value to undefined.',
    },
  },
  additionalProperties: false,
  required: ['id', 'label'],
  metadata: {
    unsupportedProps: [
      {
        name: 'onchange',
        reason: 'function-or-snippet',
      },
      {
        name: 'value',
        reason: 'generic-type-parameter',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
