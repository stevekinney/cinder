import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    min: {
      type: 'number',
      description: 'Minimum value. Default `0`.',
    },
    max: {
      type: 'number',
      description: 'Maximum value. Default `100`.',
    },
    step: {
      type: 'number',
      description: 'Step increment for arrow keys. Default `1`. Must be a positive finite number.',
    },
    pageStep: {
      type: 'number',
      description: 'Step increment for Page Up/Down. Default `step * 10`.',
    },
    label: {
      type: 'string',
      description: 'Visible label / accessible name for the slider. Required.',
    },
    unit: {
      type: 'string',
      description: 'Optional unit displayed with the current value, such as `%` or `ms`.',
    },
    ticks: {
      anyOf: [
        {
          const: false,
        },
        {
          const: true,
        },
        {
          type: 'array',
          items: {
            type: 'number',
          },
        },
      ],
      description:
        'Optional tick marks. `true` renders one per `step`; an array snaps to those values.',
    },
    disabled: {
      type: 'boolean',
      description: 'Disables interaction.',
    },
    name: {
      type: 'string',
      description: 'Form field name. Renders hidden inputs for form submission.',
    },
    class: {
      type: 'string',
      description: 'Extra class names merged with `.cinder-slider`.',
    },
    headerVisible: {
      type: 'boolean',
      description:
        "Whether the header row renders the visible label span. Default `true`.\nHides only the label — the visible value text always stays, with no\nlayout gap left behind — and never affects the thumbs' accessible\nnames, which come from `label` regardless.\n\nThis composes with, rather than replaces, the automatic label\nsuppression a Slider already performs inside `<FormField>` (the field\nowns the label there via `aria-labelledby`, so Slider's own label span\nis omitted independent of this prop). Setting `headerVisible={false}`\ninside a FormField is a no-op for the label — it's already hidden —\nbut still governs the value span the same way it does standalone.",
    },
    mode: {
      enum: ['single', 'range'],
      description:
        'Slider mode. `"single"` renders one thumb and emits a scalar value; `"range"` renders two thumbs and emits a `[low, high]` tuple. Default `"single"`.',
    },
  },
  additionalProperties: false,
  required: ['label'],
  metadata: {
    unsupportedProps: [
      {
        name: 'displayValue',
        reason: 'function-or-snippet',
        description:
          'Formats the visible value text shown in the header. Replaces only the\nvalue display — the `valueText` ARIA formatter is untouched. Absent a\nformatter, the value renders with the current unit-based formatting.',
      },
      {
        name: 'onValueChange',
        reason: 'function-or-snippet',
      },
      {
        name: 'value',
        reason: 'unknown-shape',
      },
      {
        name: 'valueText',
        reason: 'function-or-snippet',
        description: 'Formats the numeric value for `aria-valuetext`.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
