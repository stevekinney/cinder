import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    disabled: {
      type: 'boolean',
      description: 'When true, disables the input, matching the native `disabled` attribute.',
    },
    required: {
      type: 'boolean',
      description:
        'Marks the input as required for form validation, matching the native `required` attribute.',
    },
    type: {
      enum: ['number', 'date', 'email', 'password', 'search', 'tel', 'text', 'url'],
      description:
        'Input type controlling the browser\'s built-in validation and keyboard. Default `"text"`.',
    },
    id: {
      type: 'string',
      description:
        'HTML `id` for the underlying input, used to associate the `<label>` and ARIA attributes. Required.',
    },
    leadingInteractive: {
      type: 'boolean',
      description:
        'When true, the leading adornment is interactive and included in the accessibility tree. Default `false`.',
    },
    trailingInteractive: {
      type: 'boolean',
      description:
        'When true, the trailing adornment is interactive and included in the accessibility tree. Default `false`.',
    },
    label: {
      type: 'string',
      description: 'Visible label text rendered above the input and linked via `for`/`id`.',
    },
    hideLabel: {
      type: 'boolean',
      description:
        'Visually hide the rendered `label` while keeping it programmatically associated.',
    },
    description: {
      type: 'string',
      description: 'Helper text rendered below the input and associated via `aria-describedby`.',
    },
    error: {
      type: 'string',
      description: 'Error message rendered below the input; also sets `aria-invalid` on the input.',
    },
  },
  additionalProperties: false,
  required: ['id'],
  metadata: {
    unsupportedProps: [
      {
        name: 'class',
        reason: 'unknown-shape',
      },
      {
        name: 'leading',
        reason: 'function-or-snippet',
      },
      {
        name: 'onValueChange',
        reason: 'function-or-snippet',
        description:
          'Intercept a proposed value before the bindable value is written. Return a replacement value to transform it.',
      },
      {
        name: 'trailing',
        reason: 'function-or-snippet',
      },
      {
        name: 'value',
        reason: 'unknown-shape',
        required: true,
        description: 'Bindable current text value of the input.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
