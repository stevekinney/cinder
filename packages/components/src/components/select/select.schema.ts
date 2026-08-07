import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    disabled: {
      type: 'boolean',
      description: 'Disables the control.',
    },
    required: {
      type: 'boolean',
      description: 'Marks the control required and sets the native `required` attribute.',
    },
    id: {
      type: 'string',
      description: 'Unique identifier — required for label association and ARIA wiring.',
    },
    label: {
      type: 'string',
      description: 'Visible label rendered in a `<label>` associated via `for`.',
    },
    labelVisible: {
      type: 'boolean',
      description:
        'Whether the label is visibly rendered. Default `true`; set `false` to visually hide it while keeping it available to assistive technology.',
    },
    description: {
      type: 'string',
      description: 'Helper text rendered below the control; wired via `aria-describedby`.',
    },
    error: {
      type: 'string',
      description:
        'Validation error message; sets `aria-invalid="true"` and is wired via `aria-describedby`.',
    },
    class: {
      type: 'string',
      description: 'Extra class names merged with `.cinder-select-field`.',
    },
  },
  additionalProperties: false,
  required: ['id'],
  metadata: {
    unsupportedProps: [
      {
        name: 'options',
        reason: 'unknown-shape',
        required: true,
        description: 'Options to render as `<option>` children. The sole inference source for T.',
      },
      {
        name: 'value',
        reason: 'generic-type-parameter',
        description: 'Bound selected value. `undefined` when nothing is selected.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
