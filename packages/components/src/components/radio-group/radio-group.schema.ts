import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    value: {
      type: 'string',
      description: 'Bound selected value.',
    },
    name: {
      type: 'string',
      description:
        'Shared `name` for all radios in the group; required for native form submission.',
    },
    label: {
      type: 'string',
      description:
        'Visible group caption. Rendered as a `<legend>` inside the `<fieldset>`.\nNamed `label` for consistency with every other form control — the element\nis a `<legend>` because the group is a fieldset.',
    },
    description: {
      type: 'string',
      description:
        'Helper text displayed below the group; wired via `aria-describedby` on the fieldset.',
    },
    error: {
      type: 'string',
      description: 'Validation error message; sets `aria-invalid="true"` on the group\'s children.',
    },
    disabled: {
      type: 'boolean',
      description: 'Disables the entire group.',
    },
    required: {
      type: 'boolean',
      description: "When true, marks the group's radios as required for form submission.",
    },
    variant: {
      enum: ['default', 'card'],
      description: "Visual layout. 'card' wraps each radio row in a bordered surface.",
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-radio-group`.',
    },
  },
  additionalProperties: false,
  required: ['name'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Radio children.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
