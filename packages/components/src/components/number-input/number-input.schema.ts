import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    disabled: {
      type: 'boolean',
      description:
        'When true, disables the input and stepper buttons, matching the native `disabled` attribute.',
    },
    required: {
      type: 'boolean',
      description:
        'Marks the input as required for form validation, matching the native `required` attribute.',
    },
    id: {
      type: 'string',
      description:
        'HTML `id` for the underlying input, used to associate the `<label>` and ARIA attributes. Required.',
    },
    value: {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
      description: 'Bindable current numeric value, or `null` when the field is empty.',
    },
    defaultValue: {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
      description:
        'Initial value used when the component is uncontrolled or when the form is reset.',
    },
    min: {
      type: 'number',
      description:
        'Minimum permitted value; the stepper decrement button disables when this bound is reached.',
    },
    max: {
      type: 'number',
      description:
        'Maximum permitted value; the stepper increment button disables when this bound is reached.',
    },
    step: {
      type: 'number',
      description: 'Amount added or subtracted per stepper click or arrow-key press. Default `1`.',
    },
    locale: {
      type: 'string',
      description:
        'BCP 47 locale tag used for number formatting and parsing. Defaults to `navigator.language`.',
    },
    name: {
      type: 'string',
      description: "Name used to identify this field's value in form data.",
    },
    label: {
      type: 'string',
      description: 'Visible label text rendered above the input and linked via `for`/`id`.',
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
        name: 'format',
        reason: 'unknown-shape',
        description:
          "Locale-aware formatting options passed to `Intl.NumberFormat`.\nSupports all `Intl.NumberFormatOptions` properties such as `style`\n(`'decimal'`, `'currency'`, `'percent'`, `'unit'`), `currency`,\n`minimumFractionDigits`, `maximumFractionDigits`, and `notation`.\nDefaults to locale-standard decimal formatting when omitted.",
      },
      {
        name: 'onchange',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
